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
import argparse
import pathlib
import re
import sys
from collections import deque

GAME = pathlib.Path(__file__).resolve().parent.parent


ABILITY_SETS = {
    "basic": set(),
    "knight": {"charge", "bash"},
    "ranger": {"hop", "rope"},
    "mage": {"float", "blink"},
    "rat": {"leap"},
    "weaver": {"bridge"},
}


LEVELS_JS = GAME / "src" / "levels.js"

# Per-level minimums, keyed by level number (1-based). See Expansion_Plan.md, R2.
ENEMY_MIN = {1: 5, 2: 8, 3: 8, 4: 11, 5: 11, 6: 13, 7: 14, 8: 1}
SPIKE_MIN = {1: 0, 2: 4, 3: 0, 4: 6, 5: 2, 6: 10, 7: 6, 8: 0}
CRACK_MIN = {1: 0, 2: 0, 3: 0, 4: 4, 5: 4, 6: 4, 7: 4, 8: 0}
ENEMY_CHARS = "gmjaW"
# Characters whose exclusive secrets the game-wide check looks for.
EXCLUSIVE_CHARS = ["knight", "ranger", "rat", "weaver"]


def load_levels():
    """All levels in levels.js, as (name, rows) pairs in play order."""
    src = LEVELS_JS.read_text(encoding="utf-8")
    levels = []
    for m in re.finditer(r'name:\s*"([^"]+)".*?rows:\s*\[(.*?)\]', src, re.S):
        rows = re.findall(r'"([^"]*)"', m.group(2))
        widths = {len(r) for r in rows}
        if len(widths) != 1:
            raise SystemExit(f"level {m.group(1)}: rows have unequal widths: {sorted(widths)}")
        levels.append((m.group(1), rows))
    if not levels:
        raise SystemExit("no levels found in levels.js")
    return levels


class Grid:
    """Map for one search pass. Tiles outside the level count as air.

    Solid tiles block the body. Rope tiles only support it: a body can stand
    on them but walks through them, as in the game.
    """

    def __init__(self, rows, ropes, breakable=False):
        self.h = len(rows)
        self.w = len(rows[0])
        # Cracked walls (x) are air for a character who can break them.
        solid_chars = "#=" if breakable else "#=x"
        self.solid = [[rows[y][x] in solid_chars for x in range(self.w)] for y in range(self.h)]
        self.ropes = ropes
        self.rows = rows
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
        # One-way tiles (_) catch a falling body, but do not block a body moving up.
        if 0 <= x < self.w and 0 <= y < self.h and self.rows[y][x] == "_":
            return True
        return self.is_solid(x, y) or (x, y) in self.ropes

    def air(self, x, y):
        return not self.is_solid(x, y)

    def settle(self, x, y):
        if x < 0 or x >= self.w or y < 0 or y >= self.h:
            return None
        return self.land[y][x]


def standing_on_ground(grid, x, y):
    """True if the tile below (x, y) is solid or a one-way tile (not a rope)."""
    if grid.is_solid(x, y + 1):
        return True
    return 0 <= y + 1 < grid.h and 0 <= x < grid.w and grid.rows[y + 1][x] == "_"


def explore(rows, abilities, start, ropes):
    """Standing tiles reachable from start with ropes fixed.

    Returns (reached, rope_sources), where rope_sources are the standing
    tiles a rope could be anchored from.
    """
    grid = Grid(rows, ropes, breakable="bash" in abilities)
    hop = "hop" in abilities
    leap = "leap" in abilities
    blink = "blink" in abilities
    charge = "charge" in abilities
    floatable = "float" in abilities
    can_rope = "rope" in abilities or "bridge" in abilities
    rope_len = 5 if "bridge" in abilities else 3

    sx, sy = start
    s0 = grid.settle(sx, sy)
    if s0 is None:
        raise SystemExit("spawn falls out of the level")
    seen = {(sx, s0)}
    queue = deque([(sx, s0)])
    rope_sources = set()

    def push(state):
        # Spikes are a death, so a standing tile on one is not a route.
        if state[1] is not None and rows[state[1]][state[0]] != "^" and state not in seen:
            seen.add(state)
            queue.append(state)

    max_up = 5 if leap else (4 if hop else 2)
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

        # A rope is anchored from real ground, not from another rope.
        if can_rope and standing_on_ground(grid, x, y) and all(grid.air(x + i, y - 1) for i in range(1, rope_len + 1)):
            rope_sources.add((x, y))

    return set(seen), rope_sources


def reachable(rows, abilities, start):
    """Standing tiles reachable, growing the rope set until nothing new appears."""
    ropes = set()
    while True:
        reached, sources = explore(rows, abilities, start, frozenset(ropes))
        grid = Grid(rows, frozenset(ropes), breakable="bash" in abilities)
        new = set()
        rope_len = 5 if "bridge" in abilities else 3
        for x, y in sources:
            for i in range(1, rope_len + 1):
                cell = (x + i, y - 1)
                if cell not in ropes and grid.air(*cell):
                    new.add(cell)
        if not new:
            return reached
        ropes |= new


def check_level(number, name, rows, secret_log):
    """Gate checks for one level. Returns a list of failure messages.

    Appends (level, label, reachers) for each secret to secret_log.
    """
    print(f"Level {number}: {name}")
    spawns = [(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch == "S"]
    flags = [(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch == "F"]
    failures = []
    if len(spawns) != 1 or len(flags) != 1:
        failures.append(f"level {number} needs exactly one S and one F (found {len(spawns)} S, {len(flags)} F)")
        print("  " + failures[-1])
        return failures
    spawn, flag = spawns[0], flags[0]
    pickups = [(ch, x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch in "ckp"]

    # Level rules: enemy and hazard spacing, and minimum counts.
    enemies = [(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch in ENEMY_CHARS]
    for ex, ey in enemies:
        if abs(ex - spawn[0]) <= 8:
            failures.append(f"level {number}: enemy at col {ex} row {ey} is within 8 columns of the start")
    for ax, ay in [(x, y) for x, y in enemies if rows[y][x] == "a"]:
        if abs(ax - flag[0]) <= 5:
            failures.append(f"level {number}: archer at col {ax} row {ay} is within 5 columns of the exit")
    counts = {
        "enemies": (len(enemies), ENEMY_MIN.get(number, 0)),
        "spikes": (sum(row.count("^") for row in rows), SPIKE_MIN.get(number, 0)),
        "cracked walls": (sum(row.count("x") for row in rows), CRACK_MIN.get(number, 0)),
    }
    for what, (have, need) in counts.items():
        print(f"  {what}: {have} (minimum {need})")
        if have < need:
            failures.append(f"level {number}: {what} {have}, need at least {need}")

    results = {name_: reachable(rows, abilities, spawn) for name_, abilities in ABILITY_SETS.items()}

    print("  Main route (spawn to exit flag):")
    for name_ in ABILITY_SETS:
        ok = any(x == flag[0] and abs(y - flag[1]) <= 1 for x, y in results[name_])
        print(f"    {name_:7s} {'OK' if ok else 'FAIL'}")
        if not ok:
            failures.append(f"level {number}: main route not reachable by {name_}")

    print("  Pickups:")
    for kind, px, py in pickups:
        def can(name_):
            return any(abs(px - x) <= 1 and abs(py - y) <= 1 for x, y in results[name_])

        by = [n for n in ABILITY_SETS if n != "basic" and can(n)]
        label = f"{ {'c': 'card', 'p': 'power-up', 'k': 'main route card'}[kind] } at col {px} row {py}"
        if kind == "k":
            print(f"    {label:26s} main route pickup  reachable by: {', '.join(by) or 'none'}")
            continue
        gated = not can("basic")
        ok = bool(by) and gated
        print(f"    {label:26s} {'OK' if ok else 'FAIL'}  reachable by: {', '.join(by) or 'none'}")
        if not by:
            failures.append(f"level {number}: {label} is not reachable by any character")
        if not gated:
            failures.append(f"level {number}: {label} is reachable with basic moves, so it is not gated")
        secret_log.append((number, label, by))
    return failures


def show(rows):
    """Print the level with a column ruler and row numbers."""
    width = len(rows[0])
    ruler = ("0123456789" * (width // 10 + 1))[:width]
    print("   " + ruler)
    for y, row in enumerate(rows):
        print(f"{y:2d} {row}")


def map_reach(rows, name):
    """Print the level with * on every standing tile the named character can reach."""
    spawn = next((x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch == "S")
    reached = reachable(rows, ABILITY_SETS[name], spawn)
    grid = [list(r) for r in rows]
    for x, y in reached:
        grid[y][x] = "*"
    show(["".join(r) for r in grid])


def main():
    parser = argparse.ArgumentParser(description="Gate validation for the Changeling levels.")
    parser.add_argument("--level", type=int, help="check only this level (1-based)")
    parser.add_argument("--show", type=int, metavar="N", help="print level N with a column ruler, then exit")
    parser.add_argument("--map", nargs=2, metavar=("N", "NAME"),
                        help="print level N with * on tiles NAME can reach, then exit. NAME is one of: " + ", ".join(ABILITY_SETS))
    args = parser.parse_args()

    levels = load_levels()
    if args.show is not None:
        show(levels[args.show - 1][1])
        return
    if args.map is not None:
        number, name = int(args.map[0]), args.map[1]
        if name not in ABILITY_SETS:
            raise SystemExit(f"unknown character {name}; use one of: {', '.join(ABILITY_SETS)}")
        map_reach(levels[number - 1][1], name)
        return

    chosen = [args.level - 1] if args.level else range(len(levels))
    failures = []
    secret_log = []
    for i in chosen:
        name, rows = levels[i]
        failures += check_level(i + 1, name, rows, secret_log)
        print()

    # Game-wide: which characters have a secret of their own.
    print("Exclusive secrets (game-wide):")
    for char in EXCLUSIVE_CHARS:
        mine = [(n, lbl) for n, lbl, by in secret_log if by == [char]]
        ok = bool(mine)
        print(f"  {char:7s} {'OK' if ok else 'FAIL'}  " + ("; ".join(f"level {n} {lbl}" for n, lbl in mine) or "no secret only this character can reach"))
        if not ok:
            failures.append(f"no secret reachable only by {char}")
    mage_alone = [(n, lbl) for n, lbl, by in secret_log if "mage" in by and len(by) <= 2]
    ok = bool(mage_alone)
    print(f"  mage    {'OK' if ok else 'FAIL'}  " + ("; ".join(f"level {n} {lbl}" for n, lbl in mage_alone) or "no secret with mage and at most one other"))
    if not ok:
        failures.append("no secret reachable by mage with at most one other character")

    if failures:
        print("FAILED:")
        for f in failures:
            print("  - " + f)
        sys.exit(1)
    print("All gate checks passed.")


if __name__ == "__main__":
    main()
