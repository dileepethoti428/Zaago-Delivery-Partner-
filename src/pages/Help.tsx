import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  MessageCircle, 
  Phone, 
  Mail, 
  Book, 
  HelpCircle,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  DollarSign,
  Star,
  Shield
} from "lucide-react";

const Help = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const faqCategories = [
    {
      title: "Getting Started",
      icon: Book,
      color: "text-primary",
      bgColor: "bg-primary/10",
      items: [
        "How to sign up as a delivery agent?",
        "What documents do I need?",
        "How to go online and start delivering?",
        "Understanding the app interface"
      ]
    },
    {
      title: "Earnings & Payments",
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
      items: [
        "How do I get paid?",
        "When are earnings deposited?",
        "Understanding delivery fees and tips",
        "Tax information for agents"
      ]
    },
    {
      title: "Orders & Delivery",
      icon: Truck,
      color: "text-warning",
      bgColor: "bg-warning/10",
      items: [
        "How to accept orders?",
        "What if customer isn't available?",
        "Handling multiple orders",
        "Reporting delivery issues"
      ]
    },
    {
      title: "Account & Safety",
      icon: Shield,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      items: [
        "Updating personal information",
        "Safety tips while delivering",
        "What to do in emergencies",
        "Reporting inappropriate behavior"
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

  const recentTickets = [
    {
      id: "TKT-001",
      title: "Payment not received for delivery #ORD123",
      status: "resolved",
      time: "2 days ago"
    },
    {
      id: "TKT-002", 
      title: "App crashed during order pickup",
      status: "in_progress",
      time: "1 week ago"
    }
  ];

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
                {category.items.map((item, itemIndex) => (
                  <div
                    key={itemIndex}
                    className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg transition-smooth cursor-pointer"
                  >
                    <p className="text-sm text-foreground">{item}</p>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Support Tickets */}
      {recentTickets.length > 0 && (
        <Card className="bg-card border-border animate-slide-up">
          <CardHeader>
            <CardTitle>Your Recent Tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {ticket.status === "resolved" ? (
                      <CheckCircle className="w-4 h-4 text-success" />
                    ) : (
                      <Clock className="w-4 h-4 text-warning" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground">#{ticket.id} • {ticket.time}</p>
                  </div>
                </div>
                <Badge 
                  className={
                    ticket.status === "resolved" 
                      ? "bg-success/20 text-success" 
                      : "bg-warning/20 text-warning"
                  }
                >
                  {ticket.status === "resolved" ? "Resolved" : "In Progress"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contact Form */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle>Still Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Subject</label>
            <Input placeholder="Describe your issue briefly" className="bg-input border-border" />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Message</label>
            <Textarea 
              placeholder="Provide more details about your issue..."
              className="bg-input border-border min-h-[100px]"
            />
          </div>
          
          <Button className="w-full bg-gradient-neon hover:shadow-neon transition-smooth">
            <MessageCircle className="w-4 h-4 mr-2" />
            Submit Ticket
          </Button>
        </CardContent>
      </Card>

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