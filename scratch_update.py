import os

filepath = 'src/app/schedule/[userId]/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_generate = """function generateDaySlots(dateStr: string, durationMins: number = 60, bufferMins: number = 0, ownerTimezone: string = 'Asia/Kolkata') {
  const slots = [];
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ownerTimezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  
  const parts = formatter.formatToParts(new Date());
  let yyyy, mm, dd, hh, min;
  for (const part of parts) {
    if (part.type === 'year') yyyy = part.value;
    if (part.type === 'month') mm = part.value;
    if (part.type === 'day') dd = part.value;
    if (part.type === 'hour') hh = part.value;
    if (part.type === 'minute') min = part.value;
  }
  const todayDate = `${yyyy}-${mm}-${dd}`;
  const currentHour = hh === '24' ? 0 : parseInt(hh || '0', 10);
  const currentMin = parseInt(min || '0', 10);
  const isToday = dateStr === todayDate;

  let startMins = 9 * 60; // 9 AM
  const endMins = 17 * 60; // 5 PM

  while (startMins + durationMins <= endMins) {
    const h = Math.floor(startMins / 60);
    const m = startMins % 60;
    
    if (isToday && (h < currentHour || (h === currentHour && m <= currentMin))) {
        startMins += durationMins + bufferMins;
        continue;
    }
    
    const startH = String(h).padStart(2, '0');
    const startM = String(m).padStart(2, '0');
    
    const endH = String(Math.floor((startMins + durationMins) / 60)).padStart(2, '0');
    const endM = String((startMins + durationMins) % 60).padStart(2, '0');

    slots.push({
      id: `${dateStr}-${startH}:${startM}`,
      date: dateStr,
      start_time: `${startH}:${startM}:00`,
      end_time: `${endH}:${endM}:00`,
    });
    
    startMins += durationMins + bufferMins;
  }
  return slots;
}"""

start_idx = content.find('function generateDaySlots')
end_idx = content.find('export default function UserSchedulePage()')
content = content[:start_idx] + new_generate + '\n\n' + content[end_idx:]

state_str = '  const [selectedMeetingType, setSelectedMeetingType] = useState<any>(null);'
content = content.replace('const [bookName, setBookName] = useState("");', state_str + '\n  const [bookName, setBookName] = useState("");')

effect_content = '''      setProfile(targetProfile);
      if (targetProfile?.meeting_types && targetProfile.meeting_types.length > 0) {
        setSelectedMeetingType(targetProfile.meeting_types[0]);
      }'''
content = content.replace('setProfile(targetProfile);', effect_content)

allslots_old = 'const allSlots = useMemo(() => generateDaySlots(formattedDate), [formattedDate]);'
allslots_new = '''const allSlots = useMemo(() => {
    return generateDaySlots(
      formattedDate, 
      selectedMeetingType?.duration_mins || 60, 
      profile?.buffer_time_mins || 0,
      profile?.timezone || 'UTC'
    );
  }, [formattedDate, selectedMeetingType, profile]);'''
content = content.replace(allslots_old, allslots_new)

api_call_old = 'description: bookReason,'
api_call_new = 'description: bookReason,\n          meetingType: selectedMeetingType?.name,'
content = content.replace(api_call_old, api_call_new)

# UI changes for meeting types and timezone
hero_ui = '''
      {/* User info */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.display_name} className="w-16 h-16 rounded-full object-cover border border-white/10" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{profile?.display_name}'s Schedule</h2>
            <p className="text-sm text-muted-foreground">{profile?.occupation ? `${profile.occupation} • ${profile.email}` : profile?.email}</p>
            {profile?.bio && <p className="text-sm mt-1 max-w-xl">{profile.bio}</p>}
            {profile?.timezone && <p className="text-xs text-primary mt-2 flex items-center gap-1"><Clock className="w-3 h-3" /> All times are in {profile.timezone}</p>}
          </div>
        </div>
      </div>

      {profile?.meeting_types && profile.meeting_types.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold mb-3">Select Meeting Type</h3>
          <div className="flex flex-wrap gap-2">
            {profile.meeting_types.map((mt: any) => (
              <Button 
                key={mt.name} 
                variant={selectedMeetingType?.name === mt.name ? "default" : "outline"}
                onClick={() => setSelectedMeetingType(mt)}
                className="gap-2"
              >
                {mt.name} ({mt.duration_mins} min)
              </Button>
            ))}
          </div>
        </div>
      )}
'''

content = content.replace('''      {/* User info */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{profile?.display_name}&apos;s Schedule</h2>
            <p className="text-xs text-muted-foreground">{profile?.occupation ? `${profile.occupation} • ${profile.email}` : profile?.email}</p>
          </div>
        </div>
      </div>''', hero_ui)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
