# Jarvis Games

A small multiplayer browser-games site: FastAPI backend + plain HTML/JS front-ends. UK / RU / EN interface.

Games: chess, checkers, reversi, connect-4 (2D and 3D), battleship, durak, uno, poker, mafia, bunker, geobunker, alias,
quoridor, tetris, snake, 2048, wordle, minesweeper, space invaders, and more. Plus an English-learning mode (`learn.py`).

## Run

```
pip install fastapi uvicorn
uvicorn server:app --port 8000
```

Runtime state (user database, session secret) is created under `/data` (or the working directory locally) and is not part
of the repository.

## Configuration (environment variables)

| Variable | Used for |
|---|---|
| `GROQ_API_KEY` | speech transcription in the learning mode |
| `OPENROUTER_KEY` | AI features in `server.py` |
| `GEMINI_API_KEY` | AI features in `variants.py` |
| `ROOT_USERNAME`, `ROOT_PASSWORD` | optional: creates the first admin (root) account on startup if it does not exist |

All are optional; features that need them are disabled when the variable is empty. No keys are stored in this repository.

## Notes

- Chess piece graphics: Cburnett, CC BY-SA 3.0 (see `static/assets/chess/LICENSE.md`).
- The ship skin images used by the Space Invaders page are not included; the page falls back to a broken-image icon
  until you add your own to `static/assets/skins/`.
- Source code has no license file yet, so all rights are reserved by default.
