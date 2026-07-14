export function showAlert(message, isError = false) {
  const toast = document.getElementById('toast-alert');

  toast.textContent = message;
  toast.className = `fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-full shadow-xl text-sm font-medium transition-all duration-300 ${
    isError ? 'bg-red-500' : 'bg-slate-800'
  } text-white opacity-100 translate-y-0`;

  toast.classList.remove('hidden');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 4500);
}