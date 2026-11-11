"use client";

export default function StorageNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="storage-notice" role="status">
      <span aria-hidden="true">!</span>
      <div className="storage-notice-copy">
        <p>{message}</p>
        {onRetry && <button className="text-button" type="button" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  );
}
