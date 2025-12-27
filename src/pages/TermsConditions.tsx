import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { LegalDocumentViewer } from '@/components/legal/LegalDocumentViewer';
import { TERMS_CONDITIONS_SECTIONS, LEGAL_VERSIONS } from '@/constants/legalContent';

export default function TermsConditions() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Terms & Conditions</h1>
              <p className="text-xs text-muted-foreground">Delivery Agent App</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-2xl mx-auto px-4 py-6 pb-20">
        <LegalDocumentViewer
          title="Terms & Conditions"
          subtitle="Zaago Delivery Agent App"
          version={LEGAL_VERSIONS.terms}
          sections={TERMS_CONDITIONS_SECTIONS}
        />
      </div>
    </div>
  );
}
