import sqlite3
import time
import re
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from server import _auth_db, current_user, _client_ip, _clean

router = APIRouter()

_support_db_initialized = False

def _get_support_db():
    global _support_db_initialized
    # Reuse the same DB connection as the rest of the application
    con = _auth_db()
    if not _support_db_initialized:
        con.execute("""CREATE TABLE IF NOT EXISTS support_tickets(
            id INTEGER PRIMARY KEY, 
            created_at TEXT, 
            username TEXT NULL, 
            category TEXT, 
            message TEXT, 
            contact TEXT NULL, 
            page TEXT, 
            lang TEXT, 
            user_agent TEXT, 
            status TEXT DEFAULT 'new', 
            admin_note TEXT NULL, 
            updated_at TEXT
        )""")
        con.execute("""CREATE TABLE IF NOT EXISTS support_rl(
            ip_or_user TEXT, 
            ts REAL
        )""")
        con.commit()
        _support_db_initialized = True
    return con

def _strip_control_chars(s):
    if not isinstance(s, str):
        return ""
    return re.sub(r"[\x00-\x1f]+", "", s)

@router.post("/api/support")
async def create_support_ticket(request: Request):
    user = current_user(request)
    username = user["username"] if user else None
    ip = _client_ip(request)
    
    # Check rate limit
    ip_or_user = username if username else ip
    limit = 5 if username else 3
    now = time.time()
    one_hour_ago = now - 3600
    
    con = _get_support_db()
    try:
        con.execute("DELETE FROM support_rl WHERE ts < ?", (one_hour_ago,))
        count = con.execute("SELECT COUNT(*) FROM support_rl WHERE ip_or_user = ?", (ip_or_user,)).fetchone()[0]
        if count >= limit:
            return JSONResponse({"ok": False, "error": "Too many requests"})
        
        body = await request.json()
        category = str(body.get("category", "")).strip()
        message = str(body.get("message", "")).strip()
        contact = str(body.get("contact", "")).strip()
        page = str(body.get("page", "")).strip()
        lang = str(body.get("lang", "")).strip()
        
        if category not in ("Bug", "Complaint", "Idea", "Other"):
            return JSONResponse({"ok": False, "error": "Invalid category"})
            
        if not (5 <= len(message) <= 2000):
            return JSONResponse({"ok": False, "error": "Message must be between 5 and 2000 characters"})
            
        if len(contact) > 120:
            return JSONResponse({"ok": False, "error": "Contact too long"})
            
        message = _strip_control_chars(message)
        contact = _strip_control_chars(contact)
        category = _strip_control_chars(category)
        page = _strip_control_chars(page)
        lang = _strip_control_chars(lang)
        
        import datetime
        created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        user_agent = request.headers.get("user-agent", "")
        
        cur = con.execute("""
            INSERT INTO support_tickets (created_at, username, category, message, contact, page, lang, user_agent, status, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (created_at, username, category, message, contact, page, lang, user_agent, "new", created_at))
        
        ticket_id = cur.lastrowid
        con.execute("INSERT INTO support_rl (ip_or_user, ts) VALUES (?, ?)", (ip_or_user, now))
        con.commit()
        return JSONResponse({"ok": True, "id": ticket_id})
    finally:
        con.close()

@router.get("/api/support/tickets")
async def get_support_tickets(request: Request, status: str = "", limit: int = 50, offset: int = 0):
    user = current_user(request)
    if not user or user.get("role") != "root":
        raise HTTPException(403)
        
    con = _get_support_db()
    try:
        where_clause = "WHERE status = ?" if status else ""
        params = (status,) if status else ()
        
        total = con.execute(f"SELECT COUNT(*) FROM support_tickets {where_clause}", params).fetchone()[0]
        unread = con.execute("SELECT COUNT(*) FROM support_tickets WHERE status = 'new'").fetchone()[0]
        
        query = f"SELECT id, created_at, username, category, message, contact, page, lang, user_agent, status, admin_note, updated_at FROM support_tickets {where_clause} ORDER BY id DESC LIMIT ? OFFSET ?"
        rows = con.execute(query, params + (limit, offset)).fetchall()
        
        tickets = []
        for r in rows:
            tickets.append({
                "id": r[0],
                "created_at": r[1],
                "username": r[2],
                "category": r[3],
                "message": r[4],
                "contact": r[5],
                "page": r[6],
                "lang": r[7],
                "user_agent": r[8],
                "status": r[9],
                "admin_note": r[10],
                "updated_at": r[11]
            })
            
        return JSONResponse({
            "ok": True,
            "tickets": tickets,
            "total": total,
            "unread": unread
        })
    finally:
        con.close()

@router.post("/api/support/tickets/{id}")
async def update_support_ticket(request: Request, id: int):
    user = current_user(request)
    if not user or user.get("role") != "root":
        raise HTTPException(403)
        
    body = await request.json()
    status = body.get("status")
    admin_note = body.get("admin_note")
    
    con = _get_support_db()
    try:
        import datetime
        updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        updates = []
        params = []
        if status is not None:
            updates.append("status = ?")
            params.append(status)
        if admin_note is not None:
            updates.append("admin_note = ?")
            params.append(admin_note)
            
        if updates:
            updates.append("updated_at = ?")
            params.append(updated_at)
            
            query = f"UPDATE support_tickets SET {', '.join(updates)} WHERE id = ?"
            params.append(id)
            con.execute(query, params)
            con.commit()
            
        return JSONResponse({"ok": True})
    finally:
        con.close()

@router.get("/api/support/unread")
async def get_unread_count(request: Request):
    user = current_user(request)
    if not user or user.get("role") != "root":
        raise HTTPException(403)
        
    con = _get_support_db()
    try:
        count = con.execute("SELECT COUNT(*) FROM support_tickets WHERE status = 'new'").fetchone()[0]
        return JSONResponse({"ok": True, "count": count})
    finally:
        con.close()
