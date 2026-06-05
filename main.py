"""
世界杯球探报告 - FastAPI 后端服务 (Zeabur 部署版)
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from fastapi import FastAPI, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import httpx
import pymysql
import os

app = FastAPI(title="世界杯球探报告 API")

# 挂载静态文件
app.mount("/static", StaticFiles(directory="static"), name="static")

# 数据库配置 —— 优先读环境变量（Zeabur），没有则用本地
MYSQL_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', '@Zth283280'),
    'port': int(os.getenv('DB_PORT', '3306')),
    'database': os.getenv('DB_NAME', 'football'),
    'charset': 'utf8mb4',
}

def get_db():
    return pymysql.connect(**MYSQL_CONFIG)

# 俱乐部链接用懂球帝搜索
@app.get("/api/club-urls")
def get_club_urls():
    return {"provider": "dongqiudi", "base": "https://www.dongqiudi.com/search?q="}

@app.get("/")
def root():
    return FileResponse("static/index.html")

@app.get("/api/players")
def get_players(
    role: str = Query(None),
    league: str = Query(None),
    min_age: int = Query(17),
    max_age: int = Query(36),
    min_score: float = Query(0),
):
    conn = get_db()
    cur = conn.cursor(pymysql.cursors.DictCursor)
    sql = "SELECT * FROM scout_forwards WHERE 1=1"
    params = []
    if role:
        sql += " AND role_cn = %s"
        params.append(role)
    if league:
        sql += " AND league_name = %s"
        params.append(league)
    if min_age > 17:
        sql += " AND age >= %s"
        params.append(min_age)
    if max_age < 36:
        sql += " AND age <= %s"
        params.append(max_age)
    if min_score > 0:
        sql += " AND apex_score >= %s"
        params.append(min_score)
    sql += " ORDER BY apex_score DESC"
    cur.execute(sql, params)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    for r in rows:
        val = r.get('AI_True_Value') or 5
        r['bubble_size'] = max(8, min(60, val * 0.4))
    return rows

@app.get("/api/player/{player_id}")
def get_player(player_id: int):
    conn = get_db()
    cur = conn.cursor(pymysql.cursors.DictCursor)
    cur.execute("SELECT * FROM scout_forwards WHERE player_id = %s", (player_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row or {"error": "not found"}

@app.get("/api/filters")
def get_filters():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT role_cn FROM scout_forwards ORDER BY role_cn")
    roles = [r[0] for r in cur.fetchall()]
    cur.execute("SELECT DISTINCT league_name FROM scout_forwards WHERE league_name IS NOT NULL ORDER BY league_name")
    leagues = [r[0] for r in cur.fetchall()]
    cur.execute("SELECT MIN(age), MAX(age), COUNT(*) FROM scout_forwards")
    min_a, max_a, total = cur.fetchone()
    cur.close()
    conn.close()
    return {"roles": roles, "leagues": leagues, "min_age": min_a, "max_age": max_a, "total": total}

import asyncio

@app.get("/api/music/{song_id}")
async def proxy_music(song_id: int, request: Request):
    """代理网易云音乐音频"""
    url = f"https://music.163.com/song/media/outer/url?id={song_id}.mp3"
    range_header = request.headers.get("range", "")
    headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://music.163.com/"}
    if range_header:
        headers["Range"] = range_header
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=headers, follow_redirects=True)
            content_type = resp.headers.get("content-type", "audio/mpeg")
            resp_headers = {}
            if "content-range" in resp.headers:
                resp_headers["content-range"] = resp.headers["content-range"]
            if "accept-ranges" in resp.headers:
                resp_headers["accept-ranges"] = resp.headers["accept-ranges"]
            return StreamingResponse(
                resp.aiter_bytes(),
                media_type=content_type,
                status_code=resp.status_code,
                headers=resp_headers,
            )
    except Exception as e:
        return {"error": str(e)}
