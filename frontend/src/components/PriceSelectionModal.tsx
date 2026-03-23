import { useEffect, useMemo, useState } from 'react';
import { formatCurrencyValue } from '../utils/currency';

export interface PriceCandidate {
  price: number;
  currency: string;
  method: string;
  context?: string;
  confidence: number;
}

interface PriceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (price: number, method: string, currency: string) => void;
  productName: string | null;
  imageUrl: string | null;
  candidates: PriceCandidate[];
  suggestedPrice: { price: number; currency: string } | null;
  url: string;
}

const METHOD_LABELS: Record<string, string> = {
  'json-ld': 'Structured Data',
  'site-specific': 'Site Scraper',
  'generic-css': 'CSS Selector',
  'ai': 'AI Extraction',
};

const METHOD_DESCRIPTIONS: Record<string, string> = {
  'json-ld': 'Found in page metadata (schema.org)',
  'site-specific': 'Extracted using site-specific rules',
  'generic-css': 'Found using general price selectors',
  'ai': 'Detected by AI analysis',
};

export default function PriceSelectionModal({
  isOpen,
  onClose,
  onSelect,
  productName,
  imageUrl,
  candidates,
  suggestedPrice,
  url,
}: PriceSelectionModalProps) {
  const groupedCandidates = useMemo(() => {
    const groups = new Map<string, { key: string; entries: Array<{ candidate: PriceCandidate; index: number }> }>();

    candidates.forEach((candidate, index) => {
      const key = `${candidate.currency.toUpperCase()}|${candidate.price.toFixed(2)}`;
      if (!groups.has(key)) {
        groups.set(key, { key, entries: [] });
      }
      groups.get(key)!.entries.push({ candidate, index });
    });

    return Array.from(groups.values())
      .map((group) => {
        const sortedEntries = [...group.entries].sort((a, b) => b.candidate.confidence - a.candidate.confidence);
        const representative = sortedEntries[0];
        const methods = Array.from(new Set(group.entries.map((entry) => METHOD_LABELS[entry.candidate.method] || entry.candidate.method)));
        const context = methods.length > 1
          ? `Confirmed by ${methods.join(' + ')}`
          : (representative.candidate.context ||
             METHOD_DESCRIPTIONS[representative.candidate.method] ||
             'No additional context');

        return {
          key: group.key,
          representative,
          supportCount: group.entries.length,
          context,
        };
      })
      .sort((a, b) => {
        if (b.representative.candidate.confidence !== a.representative.candidate.confidence) {
          return b.representative.candidate.confidence - a.representative.candidate.confidence;
        }
        if (b.supportCount !== a.supportCount) {
          return b.supportCount - a.supportCount;
        }
        return 0;
      });
  }, [candidates]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (groupedCandidates.length === 0) {
      setSelectedKey(null);
      return;
    }

    if (suggestedPrice) {
      const suggestedKey = `${suggestedPrice.currency.toUpperCase()}|${suggestedPrice.price.toFixed(2)}`;
      const hasSuggested = groupedCandidates.some((candidate) => candidate.key === suggestedKey);
      setSelectedKey(hasSuggested ? suggestedKey : groupedCandidates[0].key);
      return;
    }

    if (!selectedKey || !groupedCandidates.some((candidate) => candidate.key === selectedKey)) {
      setSelectedKey(groupedCandidates[0].key);
    }
  }, [isOpen, groupedCandidates, suggestedPrice, selectedKey]);

  if (!isOpen) return null;

  const handleSelect = async () => {
    if (!selectedKey) return;
    const selectedGroup = groupedCandidates.find((candidate) => candidate.key === selectedKey);
    if (!selectedGroup) return;
    const selected = selectedGroup.representative.candidate;
    setIsSubmitting(true);
    try {
      await onSelect(selected.price, selected.method, selected.currency);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.6) return '#f59e0b';
    return '#6b7280';
  };

  return (
    <div className="price-modal-overlay">
      <style>{`
        .price-modal-overlay {
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

        .price-modal {
          background: var(--surface);
          border-radius: 1rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .price-modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border);
        }

        .price-modal-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text);
          margin: 0 0 0.5rem 0;
        }

        .price-modal-subtitle {
          font-size: 0.875rem;
          color: var(--text-muted);
          margin: 0;
        }

        .price-modal-product {
          display: flex;
          gap: 1rem;
          padding: 1rem 1.5rem;
          background: var(--background);
          border-bottom: 1px solid var(--border);
        }

        .price-modal-product-image {
          width: 64px;
          height: 64px;
          object-fit: contain;
          border-radius: 0.5rem;
          background: white;
        }

        .price-modal-product-info {
          flex: 1;
          min-width: 0;
        }

        .price-modal-product-name {
          font-weight: 500;
          color: var(--text);
          margin: 0 0 0.25rem 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .price-modal-product-url {
          font-size: 0.75rem;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .price-modal-body {
          padding: 1rem 1.5rem;
          overflow-y: auto;
          flex: 1;
        }

        .price-candidates-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .price-candidate {
          border: 2px solid var(--border);
          border-radius: 0.75rem;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .price-candidate:hover {
          border-color: var(--primary);
          background: var(--background);
        }

        .price-candidate.selected {
          border-color: var(--primary);
          background: rgba(99, 102, 241, 0.1);
        }

        .price-candidate-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .price-candidate-price {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text);
        }

        .price-candidate-confidence {
          font-size: 0.75rem;
          font-weight: 500;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          background: var(--background);
        }

        .price-candidate-method {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 0.25rem;
        }

        .price-candidate-context {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .price-candidate-check {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .price-candidate.selected .price-candidate-check {
          opacity: 1;
        }

        .price-modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border);
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        .price-modal-footer .btn {
          min-width: 100px;
        }
      `}</style>

      <div className="price-modal">
        <div className="price-modal-header">
          <h2 className="price-modal-title">
            {groupedCandidates.length > 1 ? 'Multiple Prices Found' : 'Confirm Price'}
          </h2>
          <p className="price-modal-subtitle">
            {groupedCandidates.length > 1
              ? 'We found different prices for this product. Please select the correct one.'
              : 'Please verify this is the correct price for the product.'}
          </p>
        </div>

        <div className="price-modal-product">
          {imageUrl && (
            <img src={imageUrl} alt="" className="price-modal-product-image" />
          )}
          <div className="price-modal-product-info">
            <p className="price-modal-product-name">{productName || 'Unknown Product'}</p>
            <p className="price-modal-product-url">{url}</p>
          </div>
        </div>

        <div className="price-modal-body">
          <div className="price-candidates-list">
            {groupedCandidates.map((candidateGroup) => {
              const candidate = candidateGroup.representative.candidate;
              return (
                <div
                  key={candidateGroup.key}
                  className={`price-candidate ${selectedKey === candidateGroup.key ? 'selected' : ''}`}
                  onClick={() => setSelectedKey(candidateGroup.key)}
                >
                  <div className="price-candidate-check">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="price-candidate-header">
                    <span className="price-candidate-price">
                      {formatCurrencyValue(candidate.price, candidate.currency)}
                    </span>
                    <span
                      className="price-candidate-confidence"
                      style={{ color: getConfidenceColor(candidate.confidence) }}
                    >
                      {getConfidenceLabel(candidate.confidence)} confidence
                    </span>
                  </div>
                  <div className="price-candidate-method">
                    {METHOD_LABELS[candidate.method] || candidate.method}
                  </div>
                  <div className="price-candidate-context">
                    {candidateGroup.context}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="price-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSelect}
            disabled={selectedKey === null || isSubmitting}
          >
            {isSubmitting ? <span className="spinner" /> : 'Confirm Selection'}
          </button>
        </div>
      </div>
    </div>
  );
}
