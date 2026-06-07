import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record, old_record, type } = payload

    // 1. Structural Guardrail: Only broadcast if looking_for_members changes to TRUE
    const becameAvailable = (type === 'INSERT' && record.looking_for_members === true) || 
                            (type === 'UPDATE' && record.looking_for_members === true && old_record?.looking_for_members !== true);

    if (!becameAvailable) {
      return new Response(JSON.stringify({ message: "Skipping broadcast: Team is not actively seeking members." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    }

    // 2. Retrieve Secure Webhook URL from Supabase Environment Vault
    const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_TEAM_WEBHOOK")
    if (!DISCORD_WEBHOOK_URL) {
      return new Response(JSON.stringify({ error: "Missing DISCORD_TEAM_WEBHOOK environment variable." }), { status: 500 })
    }

    // 3. Construct the Custom Rich Embed Card (Microsoft Brand Blue Accent)
    const discordPayload = {
      username: "MSC Team Matchmaker",
      avatar_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo_%282012%29.svg/512px-Microsoft_logo_%282012%29.svg.png",
      embeds: [
        {
          title: `🚀 New Team Forming: ${record.team_name}`,
          description: "A team is looking for more members! Check out the Team Lead's details below and jump in.",
          url: "https://[YOUR_FIREBASE_PROJECT_ID].web.app/events", // Change to your production Firebase URL
          color: 30932, // Microsoft Blue hex (#0078D4) converted to Integer
          fields: [
            {
              name: "👑 Team Leader",
              value: `**Name:** ${record.leader_name || 'Anonymous'}\n**Email:** ${record.leader_email || 'Hidden'}\n**Branch:** ${record.leader_branch || 'N/A'}\n**Year:** ${record.leader_year || 'N/A'}`,
              inline: false
            }
          ],
          footer: {
            text: "Microsoft Student Community • Matchmaking Sandbox"
          },
          timestamp: new Date().toISOString()
        }
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "View All Events",
              url: "https://[YOUR_FIREBASE_PROJECT_ID].web.app/events", // Change to your production Firebase URL
            }
          ]
        }
      ]
    }

    // 4. Fire the payload to the Discord API endpoint
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload)
    })

    return new Response(JSON.stringify({ success: true, message: "Matchmaking card broadcasted successfully." }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
