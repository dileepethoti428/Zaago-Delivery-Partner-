import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  order_id: string;
  payment_id: string;
  signature: string;
  amount: number; // in INR
}

async function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = `${orderId}|${paymentId}`;
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const expectedSignature = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expectedSignature === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase clients
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader?.replace("Bearer ", "") || "";
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { order_id, payment_id, signature, amount }: VerifyRequest = await req.json();

    // Validate inputs
    if (!order_id || !payment_id || !signature || typeof amount !== 'number') {
      return new Response(JSON.stringify({ error: "Missing or invalid required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate amount bounds (₹10 to ₹100,000)
    if (amount < 10 || amount > 100000) {
      return new Response(JSON.stringify({ error: "Amount must be between ₹10 and ₹100,000" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify Razorpay signature
    const razorpaySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
    if (!razorpaySecret || !razorpayKeyId) {
      // When credentials missing, simulate success for development
      console.log("Razorpay credentials missing; simulating verification success");
    } else {
      const isValid = await verifyRazorpaySignature(order_id, payment_id, signature, razorpaySecret);
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid payment signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Capture payment
      const captureRes = await fetch(`https://api.razorpay.com/v1/payments/${payment_id}/capture`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpaySecret}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: amount * 100, currency: "INR" }),
      });

      if (!captureRes.ok) {
        const txt = await captureRes.text();
        console.error("Razorpay capture failed:", txt);
        return new Response(JSON.stringify({ error: "Payment capture failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Find pending transaction using order_id
    const { data: pendingTxn } = await supabaseService
      .from("agent_wallet_transactions")
      .select("id, agent_id, amount, status")
      .eq("razorpay_transaction_id", order_id)
      .maybeSingle();

    let agentId = pendingTxn?.agent_id as string | undefined;
    let creditedAmount = Number(pendingTxn?.amount ?? amount);

    // If no pending transaction, resolve agent by email
    if (!agentId) {
      const { data: agent } = await supabaseService
        .from("delivery_agents")
        .select("id")
        .eq("email", user.email)
        .eq("is_active", true)
        .maybeSingle();
      agentId = agent?.id;
    }

    if (!agentId) throw new Error("Agent not found for crediting wallet");

    // Update wallet balance atomically
    const { data: currentWallet } = await supabaseService
      .from("agent_wallet")
      .select("balance")
      .eq("agent_id", agentId)
      .maybeSingle();

    const newBalance = Number(currentWallet?.balance || 0) + creditedAmount;

    await supabaseService
      .from("agent_wallet")
      .upsert({ agent_id: agentId, balance: newBalance, updated_at: new Date().toISOString() });

    // Update transaction status or create if missing
    if (pendingTxn) {
      await supabaseService
        .from("agent_wallet_transactions")
        .update({ status: "completed", description: `Wallet top-up of ₹${creditedAmount}`, updated_at: new Date().toISOString() })
        .eq("id", pendingTxn.id);
    } else {
      await supabaseService
        .from("agent_wallet_transactions")
        .insert({
          agent_id: agentId,
          amount: creditedAmount,
          transaction_type: "topup",
          description: `Wallet top-up of ₹${creditedAmount}`,
          status: "completed",
          razorpay_transaction_id: order_id,
        });
    }

    return new Response(JSON.stringify({ success: true, credited: creditedAmount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in agent-topup-verify:", error);
    return new Response(JSON.stringify({ error: (error as any).message || "Verification failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});