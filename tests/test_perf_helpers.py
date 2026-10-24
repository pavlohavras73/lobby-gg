import pytest
import os
import sqlite3
import json
import threading

import server
from server import _auth_secret, log_usage, _user_stats, _auth_db, _social_db, _chat_db
from learn import get_db_conn

def test_auth_secret_cached(tmp_path):
    orig_path = server.AUTH_SECRET_PATH
    try:
        temp_file = tmp_path / "auth_secret.txt"
        server.AUTH_SECRET_PATH = str(temp_file)
        server._AUTH_SECRET = None
        
        # Call it once, it should create the file
        val1 = _auth_secret()
        assert temp_file.exists()
        
        # Modify the file on disk
        with open(temp_file, "w") as f:
            f.write("modified")
            
        # Call it again, it should return the cached value
        val2 = _auth_secret()
        assert val1 == val2
        assert val2 != "modified"
    finally:
        server.AUTH_SECRET_PATH = orig_path
        server._AUTH_SECRET = None


def test_user_stats_incremental(tmp_path):
    orig_usage_log = server.USAGE_LOG
    try:
        temp_log = tmp_path / "games_usage.jsonl"
        server.USAGE_LOG = str(temp_log)
        server._USER_STATS_CACHE = None
        
        # Write initial data
        initial_data = [
            {"user": "alice", "event": "create", "game": "chess"},
            {"user": "alice", "event": "join", "game": "chess"},
            {"user": "alice", "event": "create", "game": "mafia"}
        ]
        with open(temp_log, "w", encoding="utf-8") as f:
            for entry in initial_data:
                f.write(json.dumps(entry) + "\n")
                
        # First call loads the cache
        stats = _user_stats("alice")
        assert stats["played"] == 3
        # In case of tie, order doesn't matter much, but we have 2 chess and 1 mafia
        top_games = {g: count for g, count in stats["top_games"]}
        assert top_games.get("chess") == 2
        assert top_games.get("mafia") == 1
        
        # Now add new usage incrementally
        log_usage("join", "room1", "mafia", "abcd", username="alice")
        log_usage("create", "room2", "poker", "efgh", username="alice")
        
        # Verify that new stats are updated from cache
        stats2 = _user_stats("alice")
        assert stats2["played"] == 5
        top_games2 = {g: count for g, count in stats2["top_games"]}
        assert top_games2.get("chess") == 2
        assert top_games2.get("mafia") == 2
        assert top_games2.get("poker") == 1
        
    finally:
        server.USAGE_LOG = orig_usage_log
        server._USER_STATS_CACHE = None


def test_sqlite_configuration(tmp_path):
    orig_auth_db = server.AUTH_DB
    orig_chat_db = server.CHAT_DB
    orig_prog_db = getattr(server, "PROGRESS_DB", None) or getattr(server, "PROGRESS_FILE", "/data/game_progress.db")
    
    import learn
    orig_learn_get_db_path = learn.get_db_path
    
    try:
        temp_auth = tmp_path / "auth.db"
        temp_chat = tmp_path / "chat.db"
        temp_prog = tmp_path / "prog.db"
        temp_learn = tmp_path / "learn.db"
        
        server.AUTH_DB = str(temp_auth)
        server.CHAT_DB = str(temp_chat)
        if hasattr(server, "PROGRESS_DB"):
            server.PROGRESS_DB = str(temp_prog)
        else:
            server.PROGRESS_FILE = str(temp_prog)
            
        learn.get_db_path = lambda: str(temp_learn)
        
        # Reset initialization flags
        server._auth_db_initialized = False
        server._social_db_initialized = False
        server._chat_db_initialized = False
        learn._learn_db_initialized = False
        
        dbs = [
            _auth_db(),
            _social_db(),
            _chat_db(),
            get_db_conn()
        ]
        
        for db in dbs:
            # Check WAL mode
            journal_mode = db.execute("PRAGMA journal_mode").fetchone()[0]
            assert journal_mode.lower() == "wal"
            
            db.close()
            
    finally:
        server.AUTH_DB = orig_auth_db
        server.CHAT_DB = orig_chat_db
        if hasattr(server, "PROGRESS_DB"):
            server.PROGRESS_DB = orig_prog_db
        else:
            server.PROGRESS_FILE = orig_prog_db
        learn.get_db_path = orig_learn_get_db_path
