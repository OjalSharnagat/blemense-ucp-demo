import { useEffect, useMemo, useState } from 'react'
import { GripVertical, Plus, Save, Trash2 } from 'lucide-react'
import { useCRMStore } from '@/lib/crmStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { panelClassName } from './shared'
import type { CRMSettings, CustomContactField, CustomContactFieldType } from '@/data/crm'

type StageDraft = string

const CUSTOM_FIELD_TYPES: Array<{ value: CustomContactFieldType; label: string }> = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'DROPDOWN', label: 'Dropdown' },
  { value: 'CHECKBOX', label: 'Checkbox' }
]

const DEAL_TERMINOLOGY_OPTIONS: Array<{ value: CRMSettings['dealTerminology']; label: string; description: string }> = [
  { value: 'DEAL', label: 'Deal', description: 'Best for general sales pipelines.' },
  { value: 'PROJECT', label: 'Project', description: 'Best for service businesses tracking engagements.' },
  { value: 'ENGAGEMENT', label: 'Engagement', description: 'Best for consultative or long-cycle services.' }
]

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

function uniqueId(base: string, existing: string[]): string {
  const root = slugify(base) || 'field'
  if (!existing.includes(root)) return root
  let suffix = 2
  while (existing.includes(`${root}_${suffix}`)) suffix += 1
  return `${root}_${suffix}`
}

function createCustomFieldDraft(field?: Partial<CustomContactField>): CustomContactField {
  return {
    id: field?.id || slugify(field?.label || 'new_field') || 'new_field',
    label: field?.label || 'New field',
    type: field?.type || 'TEXT',
    required: field?.required ?? false,
    options: field?.options || []
  }
}

export default function CRMSettings() {
  const { settings, updateSettings, deals } = useCRMStore()
  const [draft, setDraft] = useState<CRMSettings>(settings)
  const [newStage, setNewStage] = useState('')
  const [newSource, setNewSource] = useState('')
  const [newTeamMember, setNewTeamMember] = useState('')
  const [dragStageIndex, setDragStageIndex] = useState<number | null>(null)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const stageActivityCounts = useMemo(() => {
    return draft.dealStages.reduce<Record<string, number>>((acc, stage) => {
      acc[stage] = deals.filter((deal) => deal.stage === stage).length
      return acc
    }, {})
  }, [deals, draft.dealStages])

  const updateStage = (index: number, value: string) => {
    setDraft((prev) => {
      const next = [...prev.dealStages]
      next[index] = value
      return { ...prev, dealStages: next }
    })
  }

  const addStage = () => {
    const value = newStage.trim()
    if (!value) return
    setDraft((prev) => ({ ...prev, dealStages: [...prev.dealStages, value] }))
    setNewStage('')
  }

  const deleteStage = (index: number) => {
    const stage = draft.dealStages[index]
    if (!stage) return
    const activeCount = stageActivityCounts[stage] ?? 0
    if (activeCount > 0) {
      window.alert(`This stage still has ${activeCount} active deal(s). Move them first in Pipeline before deleting it.`)
      return
    }
    setDraft((prev) => ({ ...prev, dealStages: prev.dealStages.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const moveStage = (from: number, to: number) => {
    if (from === to) return
    setDraft((prev) => {
      const next = [...prev.dealStages]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return { ...prev, dealStages: next }
    })
  }

  const addSource = () => {
    const value = newSource.trim()
    if (!value) return
    setDraft((prev) => ({ ...prev, leadSources: [...prev.leadSources, value] }))
    setNewSource('')
  }

  const removeSource = (index: number) => {
    setDraft((prev) => ({ ...prev, leadSources: prev.leadSources.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const addTeamMember = () => {
    const value = newTeamMember.trim()
    if (!value) return
    setDraft((prev) => ({ ...prev, teamMembers: [...prev.teamMembers, value] }))
    setNewTeamMember('')
  }

  const removeTeamMember = (index: number) => {
    setDraft((prev) => ({ ...prev, teamMembers: prev.teamMembers.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const updateCustomField = (index: number, patch: Partial<CustomContactField>) => {
    setDraft((prev) => {
      const next = [...prev.customContactFields]
      next[index] = { ...next[index], ...patch }
      return { ...prev, customContactFields: next }
    })
  }

  const addCustomField = () => {
    setDraft((prev) => {
      const nextField = createCustomFieldDraft({ label: 'New field', type: 'TEXT' })
      const existingIds = prev.customContactFields.map((field) => field.id)
      nextField.id = uniqueId(nextField.label, existingIds)
      return { ...prev, customContactFields: [...prev.customContactFields, nextField] }
    })
  }

  const removeCustomField = (index: number) => {
    setDraft((prev) => ({ ...prev, customContactFields: prev.customContactFields.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const handleSave = () => {
    const nextSettings: CRMSettings = {
      ...draft,
      defaultAssignee: draft.teamMembers.includes(draft.defaultAssignee) ? draft.defaultAssignee : draft.teamMembers[0] || draft.defaultAssignee,
      dealStages: draft.dealStages.map((stage) => stage.trim()).filter(Boolean),
      leadSources: draft.leadSources.map((source) => source.trim()).filter(Boolean),
      customContactFields: draft.customContactFields.map((field) => ({
        ...field,
        id: field.id || uniqueId(field.label, draft.customContactFields.map((item) => item.id)),
        label: field.label.trim() || field.id,
        options: field.type === 'DROPDOWN' ? (field.options || []).map((option) => option.trim()).filter(Boolean) : []
      })),
      teamMembers: draft.teamMembers.map((member) => member.trim()).filter(Boolean),
      reminderDefaults: {
        call: Number(draft.reminderDefaults.call) || settings.reminderDefaults.call,
        meeting: Number(draft.reminderDefaults.meeting) || settings.reminderDefaults.meeting,
        followUp: Number(draft.reminderDefaults.followUp) || settings.reminderDefaults.followUp,
        followUpAlertDays: Number(draft.reminderDefaults.followUpAlertDays) || settings.reminderDefaults.followUpAlertDays
      }
    }

    updateSettings(nextSettings)
    setDraft(nextSettings)
  }

  return (
    <div className="dash-view space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CRM Settings</h1>
        <p className="text-sm text-muted-foreground">Tune stages, sources, fields, reminders, and the names your team uses in daily CRM work.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Pipeline Configuration</CardTitle>
            <CardDescription>Add, rename, reorder, or remove the stages your team uses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={newStage} onChange={(event) => setNewStage(event.target.value)} placeholder="Add new stage" />
              <Button type="button" onClick={addStage}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {draft.dealStages.map((stage, index) => (
                <div
                  key={`${stage}-${index}`}
                  draggable
                  onDragStart={() => setDragStageIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragStageIndex === null) return
                    moveStage(dragStageIndex, index)
                    setDragStageIndex(null)
                  }}
                  className="flex items-center gap-2 rounded-2xl border bg-muted/20 p-3"
                >
                  <button
                    type="button"
                    className="cursor-grab text-muted-foreground"
                    aria-label="Drag to reorder"
                    onMouseDown={() => setDragStageIndex(index)}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <Input value={stage} onChange={(event) => updateStage(index, event.target.value)} className="flex-1" />
                  <Badge variant="secondary">{stageActivityCounts[stage] ?? 0} deals</Badge>
                  <Button type="button" size="icon" variant="ghost" onClick={() => deleteStage(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Current defaults</CardTitle>
            <CardDescription>What the team sees right now in the CRM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Compatibility</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="flex items-start gap-3 rounded-lg border bg-background/70 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.enableSalesPipeline}
                    onChange={(event) => setDraft((prev) => ({ ...prev, enableSalesPipeline: event.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-input"
                  />
                  <span className="space-y-1">
                    <span className="block font-medium">Enable Sales Pipeline</span>
                    <span className="block text-xs text-muted-foreground">Show pipeline, deal/project boards, and campaign tools.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border bg-background/70 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.enableCampaigns}
                    onChange={(event) => setDraft((prev) => ({ ...prev, enableCampaigns: event.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-input"
                  />
                  <span className="space-y-1">
                    <span className="block font-medium">Enable Campaigns</span>
                    <span className="block text-xs text-muted-foreground">Track manual outreach and follow-up campaigns.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border bg-background/70 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.enableTeamFeatures}
                    onChange={(event) => setDraft((prev) => ({ ...prev, enableTeamFeatures: event.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-input"
                  />
                  <span className="space-y-1">
                    <span className="block font-medium">Enable Team Features</span>
                    <span className="block text-xs text-muted-foreground">Show Assigned To fields, owners, and team member lists.</span>
                  </span>
                </label>
                <div className="rounded-lg border bg-background/70 p-3 text-sm">
                  <label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Deal terminology</label>
                  <Select value={draft.dealTerminology} onChange={(event) => setDraft((prev) => ({ ...prev, dealTerminology: event.target.value as CRMSettings['dealTerminology'] }))}>
                    {DEAL_TERMINOLOGY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {DEAL_TERMINOLOGY_OPTIONS.find((option) => option.value === draft.dealTerminology)?.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Default assignee</p>
              <p className="mt-2 font-medium">{draft.defaultAssignee}</p>
            </div>
            {draft.enableTeamFeatures ? (
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Team members</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {draft.teamMembers.map((member, index) => (
                    <Badge key={member} variant="secondary" className="gap-2">
                      {member}
                      <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => removeTeamMember(index)}>
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input value={newTeamMember} onChange={(event) => setNewTeamMember(event.target.value)} placeholder="Add teammate" />
                  <Button type="button" variant="outline" onClick={addTeamMember}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Team members</p>
                <p className="mt-2 text-sm text-muted-foreground">Hidden until team features are enabled.</p>
              </div>
            )}
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Lead sources</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {draft.leadSources.map((source, index) => (
                  <Badge key={`${source}-${index}`} variant="secondary" className="gap-2">
                    {source}
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => removeSource(index)}>
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input value={newSource} onChange={(event) => setNewSource(event.target.value)} placeholder="Add lead source" />
                <Button type="button" variant="outline" onClick={addSource}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Reminder defaults</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Call reminder</label>
                  <Input type="number" value={draft.reminderDefaults.call} onChange={(event) => setDraft((prev) => ({ ...prev, reminderDefaults: { ...prev.reminderDefaults, call: Number(event.target.value) } }))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Meeting reminder</label>
                  <Input type="number" value={draft.reminderDefaults.meeting} onChange={(event) => setDraft((prev) => ({ ...prev, reminderDefaults: { ...prev.reminderDefaults, meeting: Number(event.target.value) } }))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Follow-up reminder</label>
                  <Input type="number" value={draft.reminderDefaults.followUp} onChange={(event) => setDraft((prev) => ({ ...prev, reminderDefaults: { ...prev.reminderDefaults, followUp: Number(event.target.value) } }))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Follow-up alert days</label>
                  <Input type="number" value={draft.reminderDefaults.followUpAlertDays} onChange={(event) => setDraft((prev) => ({ ...prev, reminderDefaults: { ...prev.reminderDefaults, followUpAlertDays: Number(event.target.value) } }))} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Birthday reminders</p>
                <p className="mt-2 font-medium">{draft.enableBirthdayReminders ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Follow-up alerts</p>
                <p className="mt-2 font-medium">{draft.enableFollowUpAlerts ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Custom Fields</CardTitle>
            <CardDescription>Define extra contact fields for this business, including required fields and dropdown choices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={addCustomField}>
                <Plus className="mr-2 h-4 w-4" />
                Add field
              </Button>
            </div>

            <div className="space-y-3">
              {draft.customContactFields.map((field, index) => (
                <div key={field.id} className="rounded-2xl border bg-muted/20 p-4">
                  <div className="grid gap-3 md:grid-cols-[1.1fr_0.7fr_0.45fr_auto]">
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Label</label>
                      <Input value={field.label} onChange={(event) => updateCustomField(index, { label: event.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Type</label>
                      <Select value={field.type} onChange={(event) => updateCustomField(index, { type: event.target.value as CustomContactFieldType })}>
                        {CUSTOM_FIELD_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(event) => updateCustomField(index, { required: event.target.checked })}
                          className="h-4 w-4 rounded border-input"
                        />
                        Required
                      </label>
                    </div>
                    <div className="flex items-end justify-end">
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeCustomField(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {field.type === 'DROPDOWN' ? (
                    <div className="mt-3">
                      <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Options</label>
                      <Input
                        value={(field.options || []).join(', ')}
                        onChange={(event) =>
                          updateCustomField(index, {
                            options: event.target.value
                              .split(',')
                              .map((value) => value.trim())
                              .filter(Boolean)
                          })
                        }
                        placeholder="Option 1, Option 2, Option 3"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Save and preview</CardTitle>
            <CardDescription>Save changes and check the resulting configuration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Custom fields</p>
              <p className="mt-2 font-medium">{draft.customContactFields.length} configured</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Stages</p>
              <p className="mt-2 font-medium">{draft.dealStages.length} configured</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Lead sources</p>
              <p className="mt-2 font-medium">{draft.leadSources.length} configured</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Save settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
