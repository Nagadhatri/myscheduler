import { Profile } from "@/types";

export interface Recommendation {
  profile: Profile;
  score: number;
  reasons: string[];
}

export async function getPeopleYouMayKnow(
  supabase: any,
  currentUserId: string,
  myEmail: string
): Promise<Recommendation[]> {
  try {
    // 1. Get all connections (pending, accepted, rejected) to exclude
    const { data: conns } = await supabase
      .from("connections")
      .select("requester_id, receiver_id, status")
      .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

    const excludedIds = new Set<string>([currentUserId]);
    const myFriendIds: string[] = [];

    if (conns) {
      for (const c of conns) {
        excludedIds.add(c.requester_id);
        excludedIds.add(c.receiver_id);
        if (c.status === "accepted") {
          myFriendIds.push(c.requester_id === currentUserId ? c.receiver_id : c.requester_id);
        }
      }
    }

    // 2. Fetch all profiles to find candidates
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, display_name, email, occupation");

    if (!allProfiles) return [];

    const candidates = allProfiles.filter((p: any) => !excludedIds.has(p.id));

    // Determine email domain
    const myDomain = myEmail.split("@")[1]?.toLowerCase();
    const genericDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "mail.com", "protonmail.com"];
    const isGeneric = !myDomain || genericDomains.includes(myDomain);

    // 3. Find mutual connections count
    const mutualCounts: Record<string, number> = {};
    if (myFriendIds.length > 0) {
      // Fetch connections where either requester or receiver is one of our friends
      // and status is accepted
      const { data: mutualConns } = await supabase
        .from("connections")
        .select("requester_id, receiver_id")
        .eq("status", "accepted");

      if (mutualConns) {
        for (const mc of mutualConns) {
          // If requester is my friend, then receiver is friend-of-friend
          if (myFriendIds.includes(mc.requester_id) && !excludedIds.has(mc.receiver_id)) {
            mutualCounts[mc.receiver_id] = (mutualCounts[mc.receiver_id] || 0) + 1;
          }
          // If receiver is my friend, then requester is friend-of-friend
          if (myFriendIds.includes(mc.receiver_id) && !excludedIds.has(mc.requester_id)) {
            mutualCounts[mc.requester_id] = (mutualCounts[mc.requester_id] || 0) + 1;
          }
        }
      }
    }

    // 4. Find past bookings (met before)
    const pastMetEmails = new Set<string>();

    // Bookings made by current user (by email)
    const { data: bookingsMade } = await supabase
      .from("bookings")
      .select("schedule:schedules(owner_id)")
      .eq("visitor_email", myEmail);

    if (bookingsMade) {
      // Extract owner_id of the schedules booked
      const ownerIds = bookingsMade
        .map((b: any) => b.schedule?.owner_id)
        .filter(Boolean);

      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from("profiles")
          .select("email")
          .in("id", ownerIds);
        if (owners) {
          for (const o of owners) {
            pastMetEmails.add(o.email.toLowerCase());
          }
        }
      }
    }

    // Bookings received by current user (on their schedules)
    const { data: mySchedules } = await supabase
      .from("schedules")
      .select("id")
      .eq("owner_id", currentUserId);

    if (mySchedules && mySchedules.length > 0) {
      const scheduleIds = mySchedules.map((s: any) => s.id);
      const { data: bookingsReceived } = await supabase
        .from("bookings")
        .select("visitor_email")
        .in("schedule_id", scheduleIds);

      if (bookingsReceived) {
        for (const br of bookingsReceived) {
          if (br.visitor_email) {
            pastMetEmails.add(br.visitor_email.toLowerCase());
          }
        }
      }
    }

    // Score candidates
    const recommendations: Recommendation[] = candidates.map((p: any) => {
      let score = 0;
      const reasons: string[] = [];

      // Colleague check (same email domain)
      if (!isGeneric) {
        const candidateDomain = p.email.split("@")[1]?.toLowerCase();
        if (candidateDomain === myDomain) {
          score += 5;
          reasons.push("Colleague (same email domain)");
        }
      }

      // Mutual connections check
      const mutuals = mutualCounts[p.id] || 0;
      if (mutuals > 0) {
        score += mutuals * 3;
        reasons.push(`${mutuals} mutual connection${mutuals > 1 ? "s" : ""}`);
      }

      // Past meeting check
      if (pastMetEmails.has(p.email.toLowerCase())) {
        score += 4;
        reasons.push("Met or booked in the past");
      }

      return {
        profile: p,
        score,
        reasons,
      };
    });

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations;
  } catch (error) {
    console.error("Error in getPeopleYouMayKnow:", error);
    return [];
  }
}
