# KumiCraft

Visual editor for **React + Vite** projects. Open your project, select elements on a live Canvas and change classes, styles, text, images, layout and pages: KumiCraft writes the change into **your own source files**, readable as if you had typed it, with Undo for every step.

- Works on real projects: Tailwind CSS 3/4, plain CSS, CSS Modules, Sass/Less, Bootstrap.
- Several screen sizes side by side, Layers, Library blocks, components, pages, brand tokens, build check.
- Optional AI chat with Claude Code or Antigravity CLI installed on your machine; agents can also drive KumiCraft through its MCP tools.
- Express + Pug projects open in view mode.
- Runs only on your machine (`127.0.0.1`), no account, no telemetry.

## Requirements

- Node.js 22.12 or newer.
- A React + Vite project (or an empty folder: KumiCraft offers to create one).

## Use

In the folder of your web project:

```sh
npx kumicraft
```

Or install once for the whole machine and run `kumicraft` in any project folder:

```sh
npm install -g kumicraft
kumicraft            # current folder
kumicraft ../my-app  # another folder
```

The Studio opens in your browser. Press `Ctrl+C` in the terminal to stop.

| Option         | Effect                                                     |
| -------------- | ---------------------------------------------------------- |
| `--no-open`    | Do not open the browser; open the printed link             |
| `--port <n>`   | Use a fixed port                                           |
| `mcp [folder]` | MCP server for an AI agent, talking to a running KumiCraft |

Do not add KumiCraft to your project's `dependencies`: it is a tool, run it with `npx` or install it globally.

## License

MIT. Third-party licenses: `THIRD_PARTY_LICENSES.md` published with each release.
