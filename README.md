# KumiCraft

**A visual editor for your real React + Vite code.**

Open your project, click any element on a live Canvas and change its classes, styles, text, images, layout or pages. KumiCraft writes each change straight into **your own source files**, as clean as if you had typed it yourself, and every step can be undone.

No export step, no generated copy of your app, no lock-in: close KumiCraft and your project is a normal project.

---

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Using the Studio](#using-the-studio)
- [AI assistant](#ai-assistant)
- [Connecting an external AI agent (MCP)](#connecting-an-external-ai-agent-mcp)
- [Command-line reference](#command-line-reference)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Updating and uninstalling](#updating-and-uninstalling)
- [Troubleshooting](#troubleshooting)
- [Privacy and data](#privacy-and-data)
- [Development](#development)
- [License](#license)

---

## Features

- **Edits your source code directly.** Tailwind classes, CSS rules, text, images and component props are written into the files they came from, with readable diffs.
- **Works with the styling you already use.** Tailwind CSS 3 and 4, plain CSS, CSS Modules, Sass/Less and Bootstrap behave the same in the Inspector.
- **Several screens at once.** Show the same page at desktop, tablet and phone sizes side by side, or focus on one frame and step through them.
- **Structure tools.** Layers tree, drag and drop, wrap and unwrap, duplicate, copy and paste between pages.
- **Pages, components and brand.** Create pages and routes, turn a selection into a reusable component, manage brand colors and fonts as design tokens.
- **Library.** Drag your project's own components onto the page, or ready-made blocks (rows, grids, buttons, forms, tables, cards, navbar, hero, footer) in Tailwind projects.
- **Build check.** Run your project's build from the Studio and jump to the file of each error.
- **Sign-in aware Canvas.** Pages behind a login keep their session; several sign-in sessions can run side by side for apps with more than one role.
- **Optional AI assistant.** Chat with Claude Code or Antigravity CLI to make larger changes, using the same tools as the Studio.
- **Local only.** Runs on `127.0.0.1`, needs no account and sends no telemetry.

Express + Pug projects open in view mode (browse and inspect, no editing yet).

## Requirements

|                  |                                                               |
| ---------------- | ------------------------------------------------------------- |
| Node.js          | 22.12 or newer                                                |
| Operating system | Windows 10/11, macOS, Linux                                   |
| Browser          | Chrome, Edge, Firefox or Safari (recent versions)             |
| Project          | A React + Vite project, or an empty folder to start a new one |

## Installation

Install KumiCraft once, globally. You can run this command from any folder:

```sh
npm install -g kumicraft
```

Check that it works:

```sh
kumicraft --version
```

> **macOS / Linux:** if npm reports `EACCES` (permission denied), your Node.js was installed system-wide. Install Node.js with a version manager such as [nvm](https://github.com/nvm-sh/nvm) or Homebrew (`brew install node`) and run the command again. Using `sudo` also works but is not recommended.

## Quick start

1. Open a terminal in the folder of your web project:

   ```sh
   cd path/to/my-app
   kumicraft
   ```

2. KumiCraft starts your project's dev server and opens the Studio in your browser.

3. Click an element on the Canvas, change it in the Inspector on the right, and look at your source file: the change is already there.

4. To stop KumiCraft, press `Ctrl+C` in the terminal. Pending changes are saved before it exits.

**Starting a new project:** click **New project** on the start screen (or **Project → + New project…** in the editor). Enter a project name, choose its location with **Browse…**, and click **Create project**. KumiCraft creates the folder `location/project-name` with a React + Vite + Tailwind project and installs its dependencies. Running `kumicraft` in an empty folder fills in that folder for you.

For a frontend next to an existing backend (for example an ASP.NET Core or Express API), choose the backend's parent folder as the location, so both projects sit side by side, then link the backend under **Project → Backend** so the AI assistant can read its API.

**Opening another project:** run `kumicraft path/to/other-app`, or click **Open project** in the Studio. Projects you opened before are listed on the start screen; remove one from the list with the **×** button (the folder itself is not touched).

The next time you run KumiCraft in the same folder, the Studio opens at the same address with your frames, pages and settings as you left them.

## Using the Studio

| Area                  | What it does                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Canvas** (center)   | Your running app in one or more frames. Click to select, double-click text to edit it, drag to move elements. |
| **Inspector** (right) | Classes, styles, text, image, layout and props of the selected element, plus the CSS rules that apply to it.  |
| **Layers** (left)     | The element tree of the page. Select, reorder and nest elements.                                              |
| **Pages**             | The routes of your app. Open, create and organize pages.                                                      |
| **Library**           | Your project's components and ready-made blocks to drag onto the page.                                        |
| **Files**             | The project's files, with "Open in editor" to jump to the exact line in VS Code, Cursor, WebStorm or Zed.     |
| **Toolbar**           | Undo/Redo, zoom, preview mode, frame sizes, build check and Settings.                                         |

**Settings** (gear icon) holds the interface language (English or Vietnamese), your code editor, the package manager for new projects, the preferred AI assistant and the sign-in sessions option.

Every edit goes through the Studio's history: `Ctrl+Z` undoes it in your files as well. Your own Git history is never touched.

## AI assistant

KumiCraft can work with an AI coding assistant installed on your computer. The assistant runs under your own account and subscription; KumiCraft does not resell or proxy any AI service.

Supported assistants:

- **Claude Code** (Anthropic)
- **Antigravity CLI** (Google)

**Set up:**

1. Open the chat panel or **Settings → AI Assistant**.
2. If no assistant is installed, click **Install** and confirm. KumiCraft runs the assistant's official installer for your operating system (PowerShell on Windows, `curl … | bash` on macOS and Linux) and shows its progress.
3. Click **Sign in**. A terminal window opens with the assistant's own sign-in; follow its steps, then return to the Studio.
4. Choose the assistant (or leave **Auto**) and start chatting.

Already using Claude Code or Antigravity CLI? KumiCraft finds it and uses your existing sign-in.

The assistant edits the page through KumiCraft's own tools, so its changes appear on the Canvas and can be undone like yours. Chat sessions are kept per project.

To give the assistant project-specific guidance, write it in `.kumicraft/agent-guide.md` in your project; it is included in every request.

## Connecting an external AI agent (MCP)

Any agent that supports the Model Context Protocol can drive KumiCraft from outside the Studio: read the page structure, select elements, change styles and text, insert blocks and more.

1. Start KumiCraft on your project (`kumicraft` in the project folder) and keep it running.
2. Register the MCP server with your agent. For Claude Code:

   ```sh
   claude mcp add kumicraft -- kumicraft mcp "/path/to/my-app"
   ```

   For other agents, add a stdio MCP server with the command `kumicraft` and the arguments `mcp /path/to/my-app`.

The project path must be the same project KumiCraft has open.

## Command-line reference

```text
kumicraft [folder] [options]
kumicraft mcp [project-folder] [--port <n>]
```

| Command / option         | Description                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `kumicraft`              | Open the project in the current folder                                                |
| `kumicraft <folder>`     | Open the project in another folder                                                    |
| `--port <n>`             | Use a fixed Studio port (1024–65535). Default: the port used last time, or a free one |
| `--no-open`              | Do not open the browser; open the link printed in the terminal yourself               |
| `--log-level <level>`    | `fatal`, `error`, `warn`, `info` (default), `debug`, `trace` or `silent`              |
| `kumicraft mcp [folder]` | Run the MCP server for an external AI agent (see above)                               |
| `-h`, `--help`           | Show help                                                                             |
| `-v`, `--version`        | Show the installed version                                                            |

## Keyboard shortcuts

On macOS, use `⌘` where the table says `Ctrl`. Press `Ctrl+/` in the Studio to see the full list.

| Action                                 | Shortcut                                                       |
| -------------------------------------- | -------------------------------------------------------------- |
| Undo / Redo                            | `Ctrl+Z` / `Ctrl+Shift+Z` (also `Ctrl+Y` on Windows and Linux) |
| Copy / Cut / Paste                     | `Ctrl+C` / `Ctrl+X` / `Ctrl+V`                                 |
| Duplicate                              | `Ctrl+D`                                                       |
| Delete                                 | `Delete` or `Backspace`                                        |
| Wrap in a container / Unwrap           | `Ctrl+G` / `Ctrl+Shift+G`                                      |
| Move up / down among siblings          | `Ctrl+↑` / `Ctrl+↓`                                            |
| Select parent                          | `Esc`                                                          |
| Tools: select, frame, text, image, pan | `V`, `F`, `T`, `I`, `H`                                        |
| Zoom in / out                          | `Ctrl++` / `Ctrl+-`                                            |
| Zoom to 100% / fit                     | `Shift+0` / `Shift+1`                                          |
| One frame at a time / side by side     | `Shift+2`                                                      |
| Next / previous frame                  | `N` / `Shift+N`                                                |
| Jump to frame 1–8                      | `1`–`8`                                                        |
| Preview mode                           | `Alt+P`                                                        |
| Open selected element in your editor   | `Alt+E`                                                        |
| Show / hide panels                     | `Ctrl+\`                                                       |

## Updating and uninstalling

```sh
npm install -g kumicraft@latest   # update to the newest version
npm uninstall -g kumicraft        # remove KumiCraft
```

Uninstalling does not change your projects. To remove KumiCraft's data from a project as well, delete its `.kumicraft` folder.

**Try without installing:** `npx kumicraft` runs the latest version from npm's cache. Do not add KumiCraft to your project's `dependencies`: it is a tool, not a library.

## Troubleshooting

| Problem                                        | Solution                                                                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `kumicraft: command not found`                 | Open a new terminal after installing. If it still fails, check that npm's global folder is in your `PATH` (`npm prefix -g`). |
| `EACCES` during install (macOS, Linux)         | See the note under [Installation](#installation).                                                                            |
| The browser does not open                      | Open the `http://127.0.0.1:…` link printed in the terminal, or run with `--no-open`.                                         |
| The port is already in use                     | Run `kumicraft --port 5800` (any free port).                                                                                 |
| The Canvas shows an error                      | Your app's own error is shown on the Canvas. Fix it in your code or with **Build check**; the Canvas reloads by itself.      |
| The AI assistant is not found after installing | Close and reopen the terminal where KumiCraft runs, so it sees the new command, then start KumiCraft again.                  |

## Privacy and data

- KumiCraft runs only on your computer and listens on `127.0.0.1`. Other devices on your network cannot reach it.
- It needs no account and sends no usage data.
- It writes only to your project's files and to a `.kumicraft` folder inside the project (frames, pages, components and settings of that project).
- The list of recent projects and your Studio settings are stored in your user profile.
- When you use an AI assistant, your messages and the relevant project files are sent to that assistant's provider under your own account.

## Development

Building KumiCraft from source, running the tests and publishing a release are described in [docs/development.md](docs/development.md).

## License

Proprietary. Free to install and use for your own projects, personal or commercial. The code KumiCraft writes into your projects belongs to you. All other rights reserved: see [LICENSE](LICENSE).

Third-party open-source components are listed in `THIRD_PARTY_LICENSES.md`, published with each release.
