import { FSNode, resolvePath, getParentAndName, createDefaultFS } from './filesystem';

export interface TerminalState {
  cwd: string;
  fs: FSNode;
  history: string[];
  user: string;
  hostname: string;
}

export interface CommandResult {
  output: string;
  state: TerminalState;
  clear?: boolean;
}

type CommandFn = (args: string[], state: TerminalState) => CommandResult;

const HELP_TEXT = `╔══════════════════════════════════════════════════════════╗
║  COMMANDES DISPONIBLES                                   ║
╠══════════════════════════════════════════════════════════╣
║  ls [chemin]       Lister les fichiers                   ║
║  cd <chemin>       Changer de répertoire                 ║
║  pwd               Afficher le répertoire courant        ║
║  cat <fichier>     Afficher le contenu d'un fichier      ║
║  mkdir <nom>       Créer un répertoire                   ║
║  touch <nom>       Créer un fichier vide                 ║
║  rm <nom>          Supprimer un fichier                  ║
║  echo <texte>      Afficher du texte                     ║
║  whoami            Afficher l'utilisateur courant        ║
║  hostname          Afficher le nom de la machine         ║
║  date              Afficher la date et l'heure           ║
║  uname -a          Informations système                  ║
║  tree [chemin]     Arborescence des fichiers             ║
║  clear             Effacer l'écran                       ║
║  history           Historique des commandes              ║
║  reset             Réinitialiser le système de fichiers  ║
║  help              Afficher cette aide                   ║
╚══════════════════════════════════════════════════════════╝`;

function treeHelper(node: FSNode, prefix: string, isLast: boolean): string {
  const children = node.children ? Object.values(node.children) : [];
  let result = '';
  children.forEach((child, i) => {
    const last = i === children.length - 1;
    const connector = last ? '└── ' : '├── ';
    const color = child.type === 'dir' ? child.name + '/' : child.name;
    result += prefix + connector + color + '\n';
    if (child.type === 'dir') {
      result += treeHelper(child, prefix + (last ? '    ' : '│   '), last);
    }
  });
  return result;
}

const commands: Record<string, CommandFn> = {
  help: (_, state) => ({ output: HELP_TEXT, state }),

  ls: (args, state) => {
    const target = args[0] || '.';
    const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
    const longFormat = args.includes('-l') || args.includes('-la') || args.includes('-al');
    const pathArg = args.find(a => !a.startsWith('-')) || '.';
    const { node } = resolvePath(state.fs, state.cwd, pathArg);
    if (!node) return { output: `ls: impossible d'accéder à '${pathArg}': Aucun fichier ou dossier de ce type`, state };
    if (node.type === 'file') return { output: node.name, state };
    const entries = Object.values(node.children || {});
    if (longFormat) {
      const lines = entries.map(e => {
        const perm = e.permissions || (e.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--');
        const size = e.type === 'file' ? (e.content?.length || 0).toString().padStart(5) : ' 4096'.padStart(5);
        const name = e.type === 'dir' ? e.name + '/' : e.name;
        return `${perm}  1 ${state.user} ${state.user} ${size} Jan  1 00:00 ${name}`;
      });
      return { output: `total ${entries.length}\n` + lines.join('\n'), state };
    }
    const names = entries.map(e => e.type === 'dir' ? e.name + '/' : e.name);
    return { output: names.join('  '), state };
  },

  cd: (args, state) => {
    const target = args[0] || '/home/eleve';
    if (target === '~') return { output: '', state: { ...state, cwd: '/home/eleve' } };
    const { node, absolutePath } = resolvePath(state.fs, state.cwd, target);
    if (!node) return { output: `cd: ${target}: Aucun fichier ou dossier de ce type`, state };
    if (node.type !== 'dir') return { output: `cd: ${target}: N'est pas un dossier`, state };
    return { output: '', state: { ...state, cwd: absolutePath } };
  },

  pwd: (_, state) => ({ output: state.cwd, state }),

  cat: (args, state) => {
    if (!args[0]) return { output: 'cat: opérande manquant', state };
    const { node } = resolvePath(state.fs, state.cwd, args[0]);
    if (!node) return { output: `cat: ${args[0]}: Aucun fichier ou dossier de ce type`, state };
    if (node.type === 'dir') return { output: `cat: ${args[0]}: Est un dossier`, state };
    return { output: node.content || '', state };
  },

  mkdir: (args, state) => {
    if (!args[0]) return { output: 'mkdir: opérande manquant', state };
    const { parent, name } = getParentAndName(state.fs, state.cwd, args[0]);
    if (!parent || parent.type !== 'dir') return { output: `mkdir: impossible de créer le répertoire '${args[0]}'`, state };
    if (parent.children?.[name]) return { output: `mkdir: impossible de créer le répertoire '${args[0]}': Le fichier existe`, state };
    parent.children = { ...parent.children, [name]: { type: 'dir', name, children: {}, permissions: 'drwxr-xr-x' } };
    return { output: '', state: { ...state, fs: { ...state.fs } } };
  },

  touch: (args, state) => {
    if (!args[0]) return { output: 'touch: opérande manquant', state };
    const { parent, name } = getParentAndName(state.fs, state.cwd, args[0]);
    if (!parent || parent.type !== 'dir') return { output: `touch: impossible de créer '${args[0]}'`, state };
    if (!parent.children?.[name]) {
      parent.children = { ...parent.children, [name]: { type: 'file', name, content: '', permissions: '-rw-r--r--' } };
    }
    return { output: '', state: { ...state, fs: { ...state.fs } } };
  },

  rm: (args, state) => {
    if (!args[0]) return { output: 'rm: opérande manquant', state };
    const recursive = args.includes('-r') || args.includes('-rf');
    const target = args.find(a => !a.startsWith('-')) || '';
    const { parent, name } = getParentAndName(state.fs, state.cwd, target);
    if (!parent || !parent.children?.[name]) return { output: `rm: impossible de supprimer '${target}': Aucun fichier ou dossier de ce type`, state };
    const node = parent.children[name];
    if (node.type === 'dir' && !recursive) return { output: `rm: impossible de supprimer '${target}': Est un dossier (utilisez rm -r)`, state };
    const { [name]: _, ...rest } = parent.children;
    parent.children = rest;
    return { output: '', state: { ...state, fs: { ...state.fs } } };
  },

  echo: (args, state) => ({ output: args.join(' '), state }),

  whoami: (_, state) => ({ output: state.user, state }),

  hostname: (_, state) => ({ output: state.hostname, state }),

  date: (_, state) => ({ output: new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium' }), state }),

  uname: (args, state) => {
    if (args.includes('-a')) return { output: 'Linux linux-edu 5.15.0-edu #1 SMP x86_64 GNU/Linux', state };
    return { output: 'Linux', state };
  },

  tree: (args, state) => {
    const target = args[0] || '.';
    const { node, absolutePath } = resolvePath(state.fs, state.cwd, target);
    if (!node) return { output: `tree: '${target}': Aucun fichier ou dossier de ce type`, state };
    if (node.type !== 'dir') return { output: node.name, state };
    const header = target === '.' ? state.cwd : absolutePath;
    return { output: header + '\n' + treeHelper(node, '', true), state };
  },

  clear: (_, state) => ({ output: '', state, clear: true }),

  history: (_, state) => ({
    output: state.history.map((cmd, i) => `  ${(i + 1).toString().padStart(4)}  ${cmd}`).join('\n'),
    state,
  }),

  reset: (_, state) => ({
    output: '🔄 Système de fichiers réinitialisé.',
    state: { ...state, cwd: '/home/eleve', fs: createDefaultFS() },
  }),
};

export function executeCommand(input: string, state: TerminalState): CommandResult {
  const trimmed = input.trim();
  if (!trimmed) return { output: '', state };

  const newState = { ...state, history: [...state.history, trimmed] };
  const parts = trimmed.split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  const handler = commands[cmd];
  if (!handler) {
    return {
      output: `${cmd}: commande introuvable. Tapez 'help' pour la liste des commandes.`,
      state: newState,
    };
  }

  const result = handler(args, newState);
  return { ...result, state: { ...result.state, history: newState.history } };
}

export function createInitialState(): TerminalState {
  return {
    cwd: '/home/eleve',
    fs: createDefaultFS(),
    history: [],
    user: 'eleve',
    hostname: 'linux-edu',
  };
}
