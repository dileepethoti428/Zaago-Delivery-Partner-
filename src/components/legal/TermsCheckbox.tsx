import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LegalDocumentViewer } from './LegalDocumentViewer';
import { 
  PRIVACY_POLICY_SECTIONS, 
  TERMS_CONDITIONS_SECTIONS, 
  LEGAL_VERSIONS 
} from '@/constants/legalContent';

interface TermsCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function TermsCheckbox({ checked, onCheckedChange, disabled }: TermsCheckboxProps) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <div className="flex items-start space-x-3">
      <Checkbox
        id="terms-acceptance"
        checked={checked}
        onCheckedChange={(checked) => onCheckedChange(checked === true)}
        disabled={disabled}
        className="mt-1"
      />
      <Label 
        htmlFor="terms-acceptance" 
        className="text-sm leading-relaxed cursor-pointer"
      >
        I have read and agree to the{' '}
        <Sheet open={privacyOpen} onOpenChange={setPrivacyOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="link" 
              className="p-0 h-auto text-primary underline font-medium"
              type="button"
            >
              Privacy Policy
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh]">
            <SheetHeader className="sr-only">
              <SheetTitle>Privacy Policy</SheetTitle>
            </SheetHeader>
            <LegalDocumentViewer
              title="Privacy Policy"
              subtitle="Zaago Delivery Agent App"
              version={LEGAL_VERSIONS.privacy}
              sections={PRIVACY_POLICY_SECTIONS}
            />
          </SheetContent>
        </Sheet>
        {' '}and{' '}
        <Sheet open={termsOpen} onOpenChange={setTermsOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="link" 
              className="p-0 h-auto text-primary underline font-medium"
              type="button"
            >
              Terms & Conditions
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh]">
            <SheetHeader className="sr-only">
              <SheetTitle>Terms & Conditions</SheetTitle>
            </SheetHeader>
            <LegalDocumentViewer
              title="Terms & Conditions"
              subtitle="Zaago Delivery Agent App"
              version={LEGAL_VERSIONS.terms}
              sections={TERMS_CONDITIONS_SECTIONS}
            />
          </SheetContent>
        </Sheet>
      </Label>
    </div>
  );
}
