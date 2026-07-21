// ui.js
export function showAlert(mensaje, esError = false) {
  const toast = document.getElementById('toast-alert');
  if (!toast) return;

  toast.textContent = mensaje;
  toast.className = `fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-full shadow-xl text-sm font-medium transition-all duration-300 ${
    esError ? 'bg-red-500/90 text-white' : 'bg-slate-800/90 text-white'
  }`;
  toast.classList.remove('hidden', 'opacity-0', 'translate-y-4');
  toast.classList.add('opacity-100', 'translate-y-0');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 3000);
}