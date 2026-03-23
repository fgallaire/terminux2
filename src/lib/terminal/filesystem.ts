export interface FSNode {
  type: 'file' | 'dir';
  name: string;
  content?: string;
  children?: Record<string, FSNode>;
  permissions?: string;
}

function dir(name: string, children: Record<string, FSNode> = {}): FSNode {
  return { type: 'dir', name, children, permissions: 'drwxr-xr-x' };
}

function file(name: string, content: string): FSNode {
  return { type: 'file', name, content, permissions: '-rw-r--r--' };
}

export function createDefaultFS(): FSNode {
  return dir('/', {
    home: dir('home', {
      eleve: dir('eleve', {
        documents: dir('documents', {
          'cours.txt': file('cours.txt', 'Bienvenue dans le cours de Linux !\nLes commandes de base sont : ls, cd, cat, pwd, mkdir, touch, rm, echo, clear, help.'),
          'notes.txt': file('notes.txt', 'Mes notes de cours :\n- Le terminal est l\'interface en ligne de commande\n- Linux est un système d\'exploitation libre\n- Le shell interprète les commandes'),
        }),
        projets: dir('projets', {
          'hello.sh': file('hello.sh', '#!/bin/bash\necho "Bonjour le monde !"'),
          'readme.md': file('readme.md', '# Mon premier projet\nCeci est un fichier markdown.'),
        }),
        images: dir('images'),
      }),
    }),
    etc: dir('etc', {
      'hostname': file('hostname', 'linux-edu'),
      'os-release': file('os-release', 'NAME="Linux Edu"\nVERSION="1.0"\nID=linux-edu'),
    }),
    tmp: dir('tmp'),
    var: dir('var', {
      log: dir('log', {
        'syslog': file('syslog', 'Jan 1 00:00:00 linux-edu kernel: System boot complete.'),
      }),
    }),
  });
}

export function resolvePath(root: FSNode, currentPath: string, target: string): { node: FSNode | null; absolutePath: string } {
  let parts: string[];
  if (target.startsWith('/')) {
    parts = target.split('/').filter(Boolean);
  } else {
    parts = [...currentPath.split('/').filter(Boolean), ...target.split('/').filter(Boolean)];
  }

  // Resolve . and ..
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === '.') continue;
    if (p === '..') { resolved.pop(); continue; }
    resolved.push(p);
  }

  let node: FSNode = root;
  for (const p of resolved) {
    if (node.type !== 'dir' || !node.children?.[p]) {
      return { node: null, absolutePath: '/' + resolved.join('/') };
    }
    node = node.children[p];
  }

  return { node, absolutePath: '/' + resolved.join('/') };
}

export function getParentAndName(root: FSNode, currentPath: string, target: string): { parent: FSNode | null; name: string; absolutePath: string } {
  const parts = target.startsWith('/')
    ? target.split('/').filter(Boolean)
    : [...currentPath.split('/').filter(Boolean), ...target.split('/').filter(Boolean)];

  const resolved: string[] = [];
  for (const p of parts) {
    if (p === '.') continue;
    if (p === '..') { resolved.pop(); continue; }
    resolved.push(p);
  }

  const name = resolved.pop() || '';
  const parentPath = '/' + resolved.join('/');
  const { node: parent } = resolvePath(root, '/', parentPath);
  return { parent, name, absolutePath: '/' + [...resolved, name].join('/') };
}
