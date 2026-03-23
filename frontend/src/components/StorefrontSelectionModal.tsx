import { useMemo, useState } from 'react';
import { RegionalGateInfo, RegionalGateOption } from '../api/client';

interface StorefrontSelectionModalProps {
  isOpen: boolean;
  regionalGate: RegionalGateInfo | null;
  onClose: () => void;
  onSelect: (option: RegionalGateOption) => Promise<void>;
}

export default function StorefrontSelectionModal({
  isOpen,
  regionalGate,
  onClose,
  onSelect,
}: StorefrontSelectionModalProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const options = useMemo(() => regionalGate?.options || [], [regionalGate]);

  if (!isOpen || !regionalGate) return null;

  const handleSelect = async () => {
    const selected = options[selectedIndex];
    if (!selected) return;
    setIsSubmitting(true);
    try {
      await onSelect(selected);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="storefront-modal-overlay">
      <style>{`
        .storefront-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .storefront-modal {
          background: var(--surface);
          border-radius: 1rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          max-width: 540px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .storefront-modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border);
        }

        .storefront-modal-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text);
          margin: 0 0 0.5rem 0;
        }

        .storefront-modal-subtitle {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin: 0;
        }

        .storefront-modal-body {
          padding: 1rem 1.5rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .storefront-option {
          border: 2px solid var(--border);
          border-radius: 0.75rem;
          padding: 0.875rem 1rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .storefront-option:hover {
          border-color: var(--primary);
          background: var(--background);
        }

        .storefront-option.selected {
          border-color: var(--primary);
          background: rgba(99, 102, 241, 0.1);
        }

        .storefront-option-left {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .storefront-option-name {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text);
        }

        .storefront-modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border);
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }
      `}</style>

      <div className="storefront-modal">
        <div className="storefront-modal-header">
          <h2 className="storefront-modal-title">Select Storefront</h2>
          <p className="storefront-modal-subtitle">
            {regionalGate.message}
          </p>
        </div>

        <div className="storefront-modal-body">
          {options.map((option, index) => (
            <div
              key={option.id}
              className={`storefront-option ${selectedIndex === index ? 'selected' : ''}`}
              onClick={() => setSelectedIndex(index)}
            >
              <div className="storefront-option-left">
                <span className="storefront-option-name">{option.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="storefront-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSelect} disabled={isSubmitting || options.length === 0}>
            {isSubmitting ? <span className="spinner" /> : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
