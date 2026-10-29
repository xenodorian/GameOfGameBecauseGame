#!/usr/bin/env python3
"""Gate validation for the Changeling level.

Reads the level rows from game/src/levels.js and searches the standing tiles for
each ability set. It checks two things:

  1. The main route (spawn to exit flag) is reachable with every character.
  2. Each secret pickup (c, p) is reachable by at least one character, and
     is not reachable with basic moves alone, so it really is gated.
     Pickups listed in MAIN_ROUTE_PICKUPS are main-route content, not
     secrets. They are reported but not required to be gated.

This is a tile-level approximation of the game's physics, not a simulation.
Assumptions, taken from game/src/world.js and game/src/scenes.js:
  - Standing row s means the body sits in row s and the solid floor is row s+1.
  - A plain jump reaches 2 rows up and 3 columns across. A flat leap reaches 3 columns.
  - Charge (knight) adds 2 columns to a jump.
  - Blink (mage) adds 3 columns to a jump.
  - Hop (ranger) adds 2 rows to a jump.
  - Float (mage) climbs 3 rows, then drifts up to 3 columns while hovering.
  - Rope (ranger) makes three tiles one row above the body, in front of it.
    Ropes are kept for the whole search. The game keeps them for 6 s.

Run from any directory:  python3 game/tools/validate_gates.py
Exit code 0 means every check passed.
"""
import pathlib
import re
import sys
from collections import deque

GAME = pathlib.Path(__file__).resolve().parent.parent


# Pickups on the main route, as (col, row). They are not gated on purpose.
MAIN_ROUTE_PICKUPS = {(22, 12)}

ABILITY_SETS = {
    "basic": set(),
    "knight": {"charge"},
    "ranger": {"hop", "rope"},
    "mage": {"float", "blink"},
}


LEVELS_JS = GAME / "src" / "levels.js"


def load_rows():
    """Rows of the first level in levels.js. Multi-level support comes in task A3."""
    src = LEVELS_JS.read_text(encoding="utf-8")
    block = src[src.index("rows: ["):]
    block = block[: block.index("]")]
    rows = re.findall(r'"([^"]*)"', block)
    widths = {len(r) for r in rows}
    if len(widths) != 1:
        raise SystemExit(f"level rows have unequal widths: {sorted(widths)}")
    return rows


class Grid:
    """Map for one search pass. Tiles outside the level count as air.

    Solid tiles block the body. Rope tiles only support it: a body can stand
    on them but walks through them, as in the game.
    """

    def __init__(self, rows, ropes):
        self.h = len(rows)
        self.w = len(rows[0])
        self.solid = [[rows[y][x] in "#=" for x in range(self.w)] for y in range(self.h)]
        self.ropes = ropes
        # land[y][x]: row where a body falling from (x, y) comes to rest, or None.
        self.land = [[None] * self.w for _ in range(self.h)]
        for x in range(self.w):
            for y in range(self.h - 1, -1, -1):
                if self.supports(x, y + 1):
                    self.land[y][x] = y
                elif y + 1 < self.h:
                    self.land[y][x] = self.land[y + 1][x]

    def is_solid(self, x, y):
        if x < 0 or x >= self.w or y < 0 or y >= self.h:
            return False
        return self.solid[y][x]

    def supports(self, x, y):
        return self.is_solid(x, y) or (x, y) in self.ropes

    def air(self, x, y):
        return not self.is_solid(x, y)

    def settle(self, x, y):
        if x < 0 or x >= self.w or y < 0 or y >= self.h:
            return None
        return self.land[y][x]


def explore(rows, abilities, start, ropes):
    """Standing tiles reachable from start with ropes fixed.

    Returns (reached, rope_sources), where rope_sources are the standing
    tiles a rope could be anchored from.
    """
    grid = Grid(rows, ropes)
    hop = "hop" in abilities
    blink = "blink" in abilities
    charge = "charge" in abilities
    floatable = "float" in abilities
    can_rope = "rope" in abilities

    sx, sy = start
    s0 = grid.settle(sx, sy)
    if s0 is None:
        raise SystemExit("spawn falls out of the level")
    seen = {(sx, s0)}
    queue = deque([(sx, s0)])
    rope_sources = set()

    def push(state):
        if state[1] is not None and state not in seen:
            seen.add(state)
            queue.append(state)

    max_up = 4 if hop else 2
    max_across = 6 if blink else (5 if charge else 3)

    while queue:
        x, y = queue.popleft()

        # Walk one tile, or step up one row onto a higher floor.
        for dx in (-1, 1):
            nx = x + dx
            if grid.air(nx, y):
                push((nx, grid.settle(nx, y)))
            elif grid.air(nx, y - 1) and grid.air(x, y - 1):
                push((nx, grid.settle(nx, y - 1)))

        # Jump up to max_up rows and max_across columns. up = 0 is a flat leap.
        for up in range(0, max_up + 1):
            if up > 0 and not grid.air(x, y - up):
                break
            for across in range(-max_across, max_across + 1):
                if across == 0 and up == 0:
                    continue
                tx, ty = x + across, y - up
                if not grid.air(tx, ty):
                    continue
                step = 1 if across > 0 else -1
                head_clear = all(grid.air(x, y - k) for k in range(1, up + 1))
                arc_clear = all(grid.air(x + step * i, y - min(up, 1)) for i in range(1, abs(across)))
                if head_clear and arc_clear:
                    push((tx, grid.settle(tx, ty)))

        # Walk off a ledge into a horizontal run of up to 3 columns.
        for dx in (-3, -2, -1, 1, 2, 3):
            tx = x + dx
            step = 1 if dx > 0 else -1
            if grid.air(tx, y) and grid.air(x + step, y):
                ny = grid.settle(tx, y)
                if ny is not None and ny > y:
                    push((tx, ny))

        # Float: climb 3 rows, then drift while hovering.
        if floatable and all(grid.air(x, y - k) for k in range(1, 4)):
            for dxh in range(-3, 4):
                step = 1 if dxh > 0 else -1
                if all(grid.air(x + step * i, y - 3) for i in range(0, abs(dxh) + 1)):
                    push((x + dxh, grid.settle(x + dxh, y - 3)))

        if can_rope and all(grid.air(x + i, y - 1) for i in (1, 2, 3)):
            rope_sources.add((x, y))

    return set(seen), rope_sources


def reachable(rows, abilities, start):
    """Standing tiles reachable, growing the rope set until nothing new appears."""
    ropes = set()
    while True:
        reached, sources = explore(rows, abilities, start, frozenset(ropes))
        grid = Grid(rows, frozenset(ropes))
        new = set()
        for x, y in sources:
            for i in (1, 2, 3):
                cell = (x + i, y - 1)
                if cell not in ropes and grid.air(*cell):
                    new.add(cell)
        if not new:
            return reached
        ropes |= new


def main():
    rows = load_rows()
    spawn = flag = None
    pickups = []
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "S":
                spawn = (x, y)
            elif ch == "F":
                flag = (x, y)
            elif ch in "cp":
                pickups.append((ch, x, y))
    if spawn is None or flag is None:
        raise SystemExit("level needs an S spawn marker and an F exit marker")

    results = {name: reachable(rows, abilities, spawn) for name, abilities in ABILITY_SETS.items()}
    failures = []

    print("Main route (spawn to exit flag):")
    for name in ABILITY_SETS:
        ok = any(x == flag[0] and abs(y - flag[1]) <= 1 for x, y in results[name])
        print(f"  {name:7s} {'OK' if ok else 'FAIL'}")
        if not ok:
            failures.append(f"main route not reachable by {name}")

    print("Secret pickups:")
    for kind, px, py in pickups:
        def can(name):
            return any(abs(px - x) <= 1 and abs(py - y) <= 1 for x, y in results[name])

        by = [n for n in ABILITY_SETS if n != "basic" and can(n)]
        gated = not can("basic")
        label = f"{'card' if kind == 'c' else 'power-up'} at col {px} row {py}"
        if (px, py) in MAIN_ROUTE_PICKUPS:
            print(f"  {label:26s} main route pickup  reachable by: {', '.join(by) or 'none'}")
            continue
        ok = bool(by) and gated
        print(f"  {label:26s} {'OK' if ok else 'FAIL'}  reachable by: {', '.join(by) or 'none'}")
        if not by:
            failures.append(f"{label} is not reachable by any character")
        if not gated:
            failures.append(f"{label} is reachable with basic moves, so it is not gated")

    if failures:
        print("\nFAILED:")
        for f in failures:
            print("  - " + f)
        sys.exit(1)
    print("\nAll gate checks passed.")


if __name__ == "__main__":
    main()
