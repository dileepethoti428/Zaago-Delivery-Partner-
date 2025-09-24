import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  MessageCircle, 
  Phone, 
  Mail, 
  Book, 
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Truck,
  DollarSign,
  Shield
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  icon: typeof Book;
  color: string;
  bgColor: string;
  items: FAQItem[];
}

const Help = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const faqCategories = [
    {
      title: "Getting Started",
      icon: Book,
      color: "text-primary",
      bgColor: "bg-primary/10",
      items: [
        {
          question: "How to sign up as a delivery agent?",
          answer: "Download the app, tap 'Sign Up', provide your mobile number, upload required documents (Aadhaar, PAN, Driving License), and complete the verification process. You'll receive confirmation within 24-48 hours."
        },
        {
          question: "What documents do I need?",
          answer: "You need a valid Aadhaar card, PAN card, Driving License, and bank account details. All documents should be clear and valid. Additional documents may be required based on your location."
        },
        {
          question: "How to go online and start delivering?",
          answer: "Open the app, tap 'Go Online' button on the home screen. Make sure your location is enabled. You'll start receiving delivery requests based on your proximity to pickup locations."
        },  
        {
          question: "Understanding the app interface",
          answer: "The home screen shows your earnings, go online button, and current status. Navigation includes Home, Orders, Earnings, and Profile. Red notifications indicate new orders, green shows completed deliveries."
        }
      ]
    },
    {
      title: "Earnings & Payments",
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
      items: [
        {
          question: "How do I get paid?",
          answer: "Earnings are automatically transferred to your registered bank account daily. COD collections are settled at the end of each day. You can track all payments in the Earnings section."
        },
        {
          question: "When are earnings deposited?",
          answer: "Daily earnings are deposited by 6 AM the next day. If there's a bank holiday, payments may be delayed by 1-2 business days. You'll receive SMS notifications for all deposits."
        },
        {
          question: "Understanding delivery fees and tips",
          answer: "New pricing structure: Base delivery fee ₹40 (covers first 3km) + ₹9 per additional km. You earn the total customer charge minus ₹13 platform fee. Peak hour surge (15% extra) during lunch (12-2 PM), dinner (7-10 PM), and weekends. Plus 100% of customer tips."
        },
        {
          question: "Tax information for agents",
          answer: "You'll receive a yearly statement of earnings for tax filing. As an independent contractor, you're responsible for your own tax obligations. Consult a tax advisor for specific guidance."
        }
      ]
    },
    {
      title: "Orders & Delivery",
      icon: Truck,
      color: "text-warning",
      bgColor: "bg-warning/10",
      items: [
        {
          question: "How to accept orders?",
          answer: "When you receive an order notification, tap 'Accept' within 30 seconds. Review pickup and delivery locations before accepting. You can decline orders, but frequent declines may affect your acceptance rate."
        },
        {
          question: "What if customer isn't available?",
          answer: "Call the customer first. If no response, use the 'Customer Unavailable' option in the app. Wait for the specified time, then follow the app's instructions to complete or cancel the order."
        },
        {
          question: "Handling multiple orders",
          answer: "You can handle up to 3 orders simultaneously. The app will optimize your route automatically. Complete pickups in the order shown and follow delivery sequence for efficiency."
        },
        {
          question: "Reporting delivery issues",
          answer: "Use the 'Report Issue' button in the app. Common issues include wrong address, damaged items, or payment problems. Provide details and photos when requested for faster resolution."
        }
      ]
    },
    {
      title: "Account & Safety",
      icon: Shield,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      items: [
        {
          question: "Updating personal information",
          answer: "Go to Profile > Personal Details to update your information. Document changes require verification and may take 24-48 hours to process. Keep your details updated for smooth operations."
        },
        {
          question: "Safety tips while delivering",
          answer: "Always wear a helmet, follow traffic rules, and carry your phone with GPS enabled. Avoid delivering to unsafe locations late at night. Report any safety concerns immediately through the app."
        },
        {
          question: "What to do in emergencies",
          answer: "For immediate safety threats, call 911. For medical emergencies, call 108. Use the SOS button in the app to alert our support team. We have 24/7 emergency support for all agents."
        },
        {
          question: "Reporting inappropriate behavior",
          answer: "Report any inappropriate behavior by customers or other agents through the app's Report feature. Provide details and evidence if possible. All reports are taken seriously and investigated promptly."
        }
      ]
    }
  ];

  const contactOptions = [
    {
      title: "Live Chat",
      description: "Chat with our support team",
      icon: MessageCircle,
      color: "text-primary",
      bgColor: "bg-primary/10",
      available: true,
      response: "Usually responds in 2-3 minutes"
    },
    {
      title: "Phone Support",
      description: "Call our helpline",
      icon: Phone,
      color: "text-success",
      bgColor: "bg-success/10",
      available: true,
      response: "Available 24/7"
    },
    {
      title: "Email Support",
      description: "Send us an email",
      icon: Mail,
      color: "text-warning",
      bgColor: "bg-warning/10",
      available: true,
      response: "Response within 24 hours"
    }
  ];

  const toggleFaq = (categoryIndex: number, itemIndex: number) => {
    const faqKey = `${categoryIndex}-${itemIndex}`;
    setExpandedFaq(expandedFaq === faqKey ? null : faqKey);
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
        <p className="text-muted-foreground">Get help when you need it</p>
      </div>

      {/* Search */}
      <Card className="bg-card border-border animate-slide-up">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for help topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input border-border"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3 animate-slide-up">
        {contactOptions.map((option, index) => {
          const IconComponent = option.icon;
          const handleClick = () => {
            if (option.title === "Phone Support") {
              window.open(`tel:+917842343642`, '_self');
            } else if (option.title === "Live Chat") {
              window.open(`https://wa.me/917842343642`, '_blank');
            } else if (option.title === "Email Support") {
              window.open(`mailto:customerzaago@gmail.com`, '_self');
            }
          };

          return (
            <Card key={index} className="bg-card border-border hover:shadow-elevated transition-smooth cursor-pointer" onClick={handleClick}>
              <CardContent className="p-4 text-center">
                <div className={`w-12 h-12 ${option.bgColor} rounded-lg flex items-center justify-center mx-auto mb-3`}>
                  <IconComponent className={`w-6 h-6 ${option.color}`} />
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1">{option.title}</h3>
                <p className="text-xs text-muted-foreground">{option.description}</p>
                {option.available && (
                  <Badge className="bg-success/20 text-success text-xs mt-2">
                    Available
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ Categories */}
      <div className="space-y-4 animate-slide-up">
        <h2 className="text-lg font-semibold text-foreground">Frequently Asked Questions</h2>
        
        {faqCategories.map((category, categoryIndex) => {
          const IconComponent = category.icon;
          return (
            <Card key={categoryIndex} className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-3">
                  <div className={`p-2 ${category.bgColor} rounded-lg`}>
                    <IconComponent className={`w-5 h-5 ${category.color}`} />
                  </div>
                  <span>{category.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {category.items.map((item, itemIndex) => {
                  const faqKey = `${categoryIndex}-${itemIndex}`;
                  const isExpanded = expandedFaq === faqKey;
                  
                  return (
                    <div key={itemIndex} className="space-y-1">
                      <div
                        className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg transition-smooth cursor-pointer"
                        onClick={() => toggleFaq(categoryIndex, itemIndex)}
                      >
                        <p className="text-sm text-foreground font-medium">{item.question}</p>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Emergency Contact */}
      <Card className="bg-destructive/10 border-destructive/20 animate-slide-up">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <div>
              <h3 className="font-semibold text-foreground">Emergency Support</h3>
              <p className="text-sm text-muted-foreground">
                For urgent safety issues, call: <span className="font-medium text-foreground">911</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Help;