import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { useCRMStore } from '@/lib/crmStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { panelClassName } from './shared'

export default function CRMSettings() {
  const { settings, updateSettings } = useCRMStore()
  const [assignee, setAssignee] = useState(settings.defaultAssignee)
  const [dealStages, setDealStages] = useState(settings.dealStages.join(', '))
  const [leadSources, setLeadSources] = useState(settings.leadSources.join(', '))
  const [customFields, setCustomFields] = useState(settings.customContactFields.join(', '))
  const [callReminder, setCallReminder] = useState(String(settings.reminderDefaults.call))
  const [meetingReminder, setMeetingReminder] = useState(String(settings.reminderDefaults.meeting))
  const [followUpReminder, setFollowUpReminder] = useState(String(settings.reminderDefaults.followUp))
  const [birthdayReminders, setBirthdayReminders] = useState(settings.enableBirthdayReminders ? 'true' : 'false')
  const [followUpAlerts, setFollowUpAlerts] = useState(settings.enableFollowUpAlerts ? 'true' : 'false')

  useEffect(() => {
    setAssignee(settings.defaultAssignee)
    setDealStages(settings.dealStages.join(', '))
    setLeadSources(settings.leadSources.join(', '))
    setCustomFields(settings.customContactFields.join(', '))
    setCallReminder(String(settings.reminderDefaults.call))
    setMeetingReminder(String(settings.reminderDefaults.meeting))
    setFollowUpReminder(String(settings.reminderDefaults.followUp))
    setBirthdayReminders(settings.enableBirthdayReminders ? 'true' : 'false')
    setFollowUpAlerts(settings.enableFollowUpAlerts ? 'true' : 'false')
  }, [settings])

  const handleSave = () => {
    updateSettings({
      ...settings,
      defaultAssignee: assignee.trim() || settings.defaultAssignee,
      dealStages: dealStages.split(',').map((value) => value.trim()).filter(Boolean) as typeof settings.dealStages,
      leadSources: leadSources.split(',').map((value) => value.trim()).filter(Boolean) as typeof settings.leadSources,
      customContactFields: customFields.split(',').map((value) => value.trim()).filter(Boolean),
      reminderDefaults: {
        call: Number(callReminder) || settings.reminderDefaults.call,
        meeting: Number(meetingReminder) || settings.reminderDefaults.meeting,
        followUp: Number(followUpReminder) || settings.reminderDefaults.followUp
      },
      enableBirthdayReminders: birthdayReminders === 'true',
      enableFollowUpAlerts: followUpAlerts === 'true'
    })
  }

  return (
    <div className="dash-view space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CRM Settings</h1>
        <p className="text-sm text-muted-foreground">Keep the defaults aligned with how your team actually works.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Operational defaults</CardTitle>
            <CardDescription>Simple configuration for assignee, stages, and reminders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Default assignee</label>
              <Input value={assignee} onChange={(event) => setAssignee(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Deal stages</label>
              <Input value={dealStages} onChange={(event) => setDealStages(event.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Comma-separated, in order.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Lead sources</label>
              <Input value={leadSources} onChange={(event) => setLeadSources(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Custom contact fields</label>
              <Input value={customFields} onChange={(event) => setCustomFields(event.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Call reminder</label>
                <Input type="number" value={callReminder} onChange={(event) => setCallReminder(event.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Meeting reminder</label>
                <Input type="number" value={meetingReminder} onChange={(event) => setMeetingReminder(event.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Follow-up reminder</label>
                <Input type="number" value={followUpReminder} onChange={(event) => setFollowUpReminder(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Birthday reminders</label>
                <Select value={birthdayReminders} onChange={(event) => setBirthdayReminders(event.target.value)}>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Follow-up alerts</label>
                <Select value={followUpAlerts} onChange={(event) => setFollowUpAlerts(event.target.value)}>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Save settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Current configuration</CardTitle>
            <CardDescription>A quick look at what the team will see in the module.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Default assignee</p>
              <p className="mt-2 font-medium">{settings.defaultAssignee}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Deal stages</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {settings.dealStages.map((stage) => (
                  <Badge key={stage} variant="secondary">
                    {stage}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Lead sources</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {settings.leadSources.map((source) => (
                  <Badge key={source} variant="secondary">
                    {source}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Birthday reminders</p>
                <p className="mt-2 font-medium">{settings.enableBirthdayReminders ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Follow-up alerts</p>
                <p className="mt-2 font-medium">{settings.enableFollowUpAlerts ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
