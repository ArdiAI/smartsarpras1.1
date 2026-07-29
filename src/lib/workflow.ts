import { supabase } from './supabase';

export interface WorkflowTemplate { id: string; name: string; description: string | null; is_active: boolean; created_at: string; updated_at: string | null; }
export interface WorkflowStep { id: string; workflow_template_id: string; step_order: number; role_id: string | null; step_label: string; is_info_only: boolean; created_at: string; }

export async function getDefaultWorkflow(): Promise<WorkflowTemplate | null> {
  const { data, error } = await supabase.from('workflow_templates').select('*').eq('is_active', true).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error) return null;
  return data as unknown as WorkflowTemplate | null;
}

export async function getWorkflowSteps(templateId: string): Promise<WorkflowStep[]> {
  const { data, error } = await supabase.from('workflow_steps').select('*').eq('workflow_template_id', templateId).order('step_order', { ascending: true });
  if (error) return [];
  return (data as unknown as WorkflowStep[]) ?? [];
}

export async function getWorkflowLainnya(): Promise<WorkflowTemplate | null> {
  const { data, error } = await supabase.from('workflow_templates').select('*').eq('name', 'Workflow Lainnya').maybeSingle();
  if (error) return null;
  return data as unknown as WorkflowTemplate | null;
}

export async function getWorkflowByName(name: string): Promise<WorkflowTemplate | null> {
  const { data, error } = await supabase.from('workflow_templates').select('*').eq('name', name).eq('is_active', true).maybeSingle();
  if (error) return null;
  return data as unknown as WorkflowTemplate | null;
}
