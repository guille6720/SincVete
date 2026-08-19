'use client';

export function PrintManualButton() {
  return (
    <button type="button" onClick={() => window.print()}>
      Imprimir o guardar PDF
    </button>
  );
}
