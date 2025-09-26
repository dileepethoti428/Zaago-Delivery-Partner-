-- Create delivery_timings table for managing different delivery time configurations
CREATE TABLE public.delivery_timings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('immediate', 'scheduled', 'subscription')),
  time_slot_start TIME NOT NULL,
  time_slot_end TIME NOT NULL,
  slot_name TEXT NOT NULL,
  max_duration_minutes INTEGER NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_timings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active delivery timings" 
ON public.delivery_timings 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage delivery timings" 
ON public.delivery_timings 
FOR ALL 
USING (is_current_user_admin_v2())
WITH CHECK (is_current_user_admin_v2());

-- Insert default timing configurations
INSERT INTO public.delivery_timings (delivery_type, time_slot_start, time_slot_end, slot_name, max_duration_minutes, priority) VALUES
('immediate', '00:00:00', '23:59:59', 'Express Delivery', 20, 1),
('scheduled', '09:00:00', '12:00:00', 'Morning Slot', 180, 2),
('scheduled', '12:00:00', '15:00:00', 'Afternoon Slot', 180, 3),
('scheduled', '15:00:00', '18:00:00', 'Evening Slot', 180, 4),
('scheduled', '18:00:00', '21:00:00', 'Night Slot', 180, 5),
('subscription', '06:00:00', '10:00:00', 'Morning Delivery', 240, 1),
('subscription', '16:00:00', '20:00:00', 'Evening Delivery', 240, 2);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_delivery_timings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_delivery_timings_updated_at
BEFORE UPDATE ON public.delivery_timings
FOR EACH ROW
EXECUTE FUNCTION public.update_delivery_timings_updated_at();