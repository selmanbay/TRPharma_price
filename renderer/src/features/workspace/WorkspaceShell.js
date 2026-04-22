export function hideWorkspaceSearchShell() {
  const ids = [
    'workspaceSearchShell',
    'workspaceSearchStatus',
    'workspaceResultSummary',
    'workspaceVariantSection',
    'workspaceOffersSection',
    'workspaceMfCalc',
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

export function showWorkspaceSearchShell() {
  const shell = document.getElementById('workspaceSearchShell');
  if (shell) shell.style.display = 'grid';
}

export function renderWorkspaceSearchStatus(message = '', { visible = false } = {}) {
  const status = document.getElementById('workspaceSearchStatus');
  if (!status) return;
  status.textContent = message;
  status.style.display = visible ? 'flex' : 'none';
}
