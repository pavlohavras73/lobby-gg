import os
"""
Unit-тесты для quoridor.py
"""
import unittest
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from quoridor import (
    new_quoridor_state, get_valid_pawn_moves, can_place_wall,
    apply_pawn_move, apply_wall_placement, bot_choose_action,
    has_path_bfs, is_target_reached
)

class TestQuoridor(unittest.TestCase):
    def test_initial_state_2p(self):
        s = new_quoridor_state(["p1", "p2"])
        self.assertEqual(s["player_count"], 2)
        self.assertEqual(s["players"]["p1"]["pos"], (8, 4))
        self.assertEqual(s["players"]["p2"]["pos"], (0, 4))
        self.assertEqual(s["players"]["p1"]["walls"], 10)
        self.assertEqual(s["players"]["p2"]["walls"], 10)
        self.assertEqual(s["turn"], 0)

        # Initial moves for p1 at (8, 4): up, left, right (down is offboard)
        moves = get_valid_pawn_moves(s, "p1")
        self.assertIn((7, 4), moves)
        self.assertIn((8, 3), moves)
        self.assertIn((8, 5), moves)
        self.assertEqual(len(moves), 3)

    def test_initial_state_3p_4p(self):
        s3 = new_quoridor_state(["p1", "p2", "p3"])
        self.assertEqual(s3["player_count"], 3)
        self.assertEqual(s3["players"]["p1"]["walls"], 6)

        s4 = new_quoridor_state(["p1", "p2", "p3", "p4"])
        self.assertEqual(s4["player_count"], 4)
        self.assertEqual(s4["players"]["p1"]["walls"], 5)

    def test_wall_placement_and_collision(self):
        s = new_quoridor_state(["p1", "p2"])
        ok, _ = apply_wall_placement(s, "p1", 7, 3, 'h')
        self.assertTrue(ok)
        self.assertEqual(s["players"]["p1"]["walls"], 9)
        self.assertEqual(s["turn"], 1)

        # Cannot place overlapping horizontal wall
        ok2, err2 = can_place_wall(s, "p2", 7, 3, 'h')
        self.assertFalse(ok2)
        ok3, err3 = can_place_wall(s, "p2", 7, 2, 'h')
        self.assertFalse(ok3)

        # Cannot cross with vertical wall at same center
        ok4, err4 = can_place_wall(s, "p2", 7, 3, 'v')
        self.assertFalse(ok4)

    def test_trapping_prevention_bfs(self):
        s = new_quoridor_state(["p1", "p2"])
        # Place horizontal walls across columns 0, 2, 4, 6
        apply_wall_placement(s, "p1", 7, 0, 'h')
        apply_wall_placement(s, "p1", 7, 2, 'h')
        apply_wall_placement(s, "p1", 7, 4, 'h')
        apply_wall_placement(s, "p1", 7, 6, 'h')
        
        # Column 8 is still open. Sealing it with a vertical wall at (7, 7) must be rejected!
        ok, msg = can_place_wall(s, "p1", 7, 7, 'v')
        self.assertFalse(ok, "Trapping wall must be rejected by BFS check!")
        self.assertIn("перекрывает путь", msg)

    def test_straight_jump(self):
        s = new_quoridor_state(["p1", "p2"])
        # Put p1 at (4, 4), p2 at (3, 4)
        s["players"]["p1"]["pos"] = (4, 4)
        s["players"]["p2"]["pos"] = (3, 4)
        moves = get_valid_pawn_moves(s, "p1")
        # Straight jump over p2 to (2, 4)
        self.assertIn((2, 4), moves)

    def test_diagonal_jump_when_wall_behind(self):
        s = new_quoridor_state(["p1", "p2"])
        s["players"]["p1"]["pos"] = (4, 4)
        s["players"]["p2"]["pos"] = (3, 4)
        # Put horizontal wall behind p2 at (2, 4) so straight jump to (2, 4) is blocked
        apply_wall_placement(s, "p1", 2, 4, 'h')
        s["turn"] = 0
        moves = get_valid_pawn_moves(s, "p1")
        # Straight jump (2, 4) is blocked, diagonal jumps to (3, 3) and (3, 5) should be allowed
        self.assertNotIn((2, 4), moves)
        self.assertIn((3, 3), moves)
        self.assertIn((3, 5), moves)

    def test_win_condition(self):
        s = new_quoridor_state(["p1", "p2"])
        s["players"]["p1"]["pos"] = (1, 4)
        s["players"]["p2"]["pos"] = (0, 0)  # Move p2 out of the way
        ok, _ = apply_pawn_move(s, "p1", 0, 4)
        self.assertTrue(ok)
        self.assertEqual(s["winner"], "p1")

    def test_bot_action(self):
        s = new_quoridor_state(["p1", "bot"])
        action = bot_choose_action(s, "bot")
        self.assertIsNotNone(action)
        self.assertIn(action["action"], ("move", "wall"))

if __name__ == "__main__":
    unittest.main()
