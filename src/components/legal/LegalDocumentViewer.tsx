import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { LegalSection, LEGAL_VERSIONS, COMPANY_INFO } from '@/constants/legalContent';

interface LegalDocumentViewerProps {
  title: string;
  subtitle: string;
  version: string;
  sections: LegalSection[];
  className?: string;
}

export function LegalDocumentViewer({ 
  title, 
  subtitle, 
  version,
  sections, 
  className = '' 
}: LegalDocumentViewerProps) {
  return (
    <div className={`bg-background ${className}`}>
      {/* Header */}
      <div className="text-center border-b pb-4 mb-4">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            Version {version}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Last Updated: {LEGAL_VERSIONS.lastUpdated}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="h-[60vh] pr-4">
        <Accordion type="multiple" className="space-y-2" defaultValue={sections.map((_, i) => `section-${i}`)}>
          {sections.map((section, index) => (
            <AccordionItem 
              key={index} 
              value={`section-${index}`}
              className="border rounded-lg px-4 bg-card"
            >
              <AccordionTrigger className="text-left hover:no-underline">
                <span className="font-semibold text-sm text-foreground">
                  {section.title}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground pb-2">
                  {section.content.map((paragraph, pIndex) => (
                    <p key={pIndex} className={paragraph === '' ? 'h-2' : ''}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {COMPANY_INFO.fullName}. All rights reserved.</p>
          <p className="mt-1">
            For questions, contact: {COMPANY_INFO.supportEmail}
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}
