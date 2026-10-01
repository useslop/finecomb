export function NotAdviceBanner() {
  return (
    <div className="banner banner--notice" role="note">
      <strong>Not legal, medical or financial advice.</strong>
      Finecomb flags things worth asking about. You decide what to do next.
    </div>
  );
}

export function PrivacyPromiseBanner() {
  return (
    <div className="banner banner--info" role="note">
      <strong>Your bill never leaves your device.</strong>
      Parsing, OCR and every check run in your browser. No server ever receives your bill.
    </div>
  );
}
