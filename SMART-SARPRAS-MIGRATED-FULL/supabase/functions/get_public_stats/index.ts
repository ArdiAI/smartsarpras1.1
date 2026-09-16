import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch facilities count
    const { count: facilitiesCount, error: facilitiesError } = await supabase
      .from("facilities")
      .select("id", { count: "exact" })
      .limit(1);

    if (facilitiesError) {
      console.error("Facilities error:", facilitiesError);
    }

    // Fetch inventory with condition
    const { data: inventoryData, count: inventoryCount, error: inventoryError } = await supabase
      .from("inventory")
      .select("id, condition", { count: "exact" });

    if (inventoryError) {
      console.error("Inventory error:", inventoryError);
    }

    const goodCondition = Array.isArray(inventoryData)
      ? inventoryData.filter((item: any) => item.condition === "good").length
      : 0;
    const goodConditionPct = inventoryCount && inventoryCount > 0
      ? Math.round((goodCondition / inventoryCount) * 100)
      : 0;

    const response = {
      facilities: facilitiesCount || 0,
      inventory: inventoryCount || 0,
      goodCondition: goodConditionPct,
      avgResponseTime: 24,
    };

    console.log("Stats:", response);

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        facilities: 0,
        inventory: 0,
        goodCondition: 0,
        avgResponseTime: 24,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
