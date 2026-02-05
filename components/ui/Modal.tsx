import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  footer,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-warm-900/40 backdrop-blur-sm animate-fade-in">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-warm-200/60 bg-warm-50">
              <h2 className="text-xl font-medium text-warm-800">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-warm-200 transition-colors"
              >
                <X size={20} className="text-warm-500" />
              </button>
            </div>
          )}

          {/* Content */}
          {children}

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-warm-200/60 bg-warm-50 flex justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
