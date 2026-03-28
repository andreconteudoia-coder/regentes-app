import React from 'react';
import { Download } from 'lucide-react';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';

interface FormattingCardProps {
  pdfConfig: {
    columns: 'auto' | '1' | '2';
    fontSize: number;
  };
  setPdfConfig: (config: any) => void;
}

export const FormattingCard: React.FC<FormattingCardProps> = ({
  pdfConfig,
  setPdfConfig,
}) => {
  return (
    <Card className="space-y-6 border-primary/20 bg-primary/5 p-4 sm:p-6 shadow-feminine">
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-primary" />
            <label className="text-xs text-[#909296] uppercase tracking-wider font-bold">Configurações do PDF</label>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-[#5C5F66] uppercase font-bold">Colunas</label>
              <div className="flex gap-1 bg-bg-card p-1 rounded-lg">
                {(['auto', '1', '2'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setPdfConfig({...pdfConfig, columns: c})}
                    className={cn(
                      "flex-1 py-1 px-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors",
                      pdfConfig.columns === c ? "bg-primary text-white" : "text-[#5C5F66] hover:text-[#C1C2C5]"
                    )}
                  >
                    {c === 'auto' ? 'Auto' : `${c} Col`}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-[#5C5F66] uppercase font-bold">Fonte</label>
                <span className="text-[10px] font-mono text-primary">{pdfConfig.fontSize}px</span>
              </div>
              <input 
                type="range" 
                min="6" 
                max="16" 
                step="0.5"
                value={pdfConfig.fontSize}
                onChange={e => setPdfConfig({...pdfConfig, fontSize: parseFloat(e.target.value)})}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
