export default function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50 px-6 py-16 text-center">
      <h3 className="text-sm font-semibold text-red-800">Something went wrong</h3>
      <p className="mt-1 text-sm text-red-600">{message || "Please try again."}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}
