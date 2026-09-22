const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  item_type: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface WorkflowStep {
  id: string;
  workflow_template_id: string;
  step_order: number;
  role_id: string | null;
  step_label: string;
  is_info_only: boolean;
  created_at: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}


// =====================================================
// HELPER FETCH
// =====================================================

async function fetchApi<T>(
  url: string
): Promise<T | null> {
  try {
    const response = await fetch(url);

    const result =
      (await response
        .json()
        .catch(() => null)) as
        | ApiResponse<T>
        | null;

    if (
      !response.ok ||
      !result?.ok
    ) {
      console.error(
        '[WORKFLOW API]',
        result?.message ??
          `HTTP ${response.status}`
      );

      return null;
    }

    return result.data ?? null;
  } catch (error) {
    console.error(
      '[WORKFLOW API] fetch error:',
      error
    );

    return null;
  }
}


// =====================================================
// DEFAULT WORKFLOW
// =====================================================

export async function getDefaultWorkflow():
  Promise<WorkflowTemplate | null> {
  return fetchApi<WorkflowTemplate>(
    `${API_BASE_URL}/api/workflows/default`
  );
}


// =====================================================
// WORKFLOW BERDASARKAN ITEM TYPE
// =====================================================

export async function getWorkflowByItemType(
  itemType:
    | 'barang'
    | 'fasilitas'
    | 'lainnya'
): Promise<WorkflowTemplate | null> {
  return fetchApi<WorkflowTemplate>(
    `${API_BASE_URL}/api/workflows/item-type/${encodeURIComponent(
      itemType
    )}`
  );
}


// =====================================================
// WORKFLOW STEPS
// =====================================================

export async function getWorkflowSteps(
  templateId: string
): Promise<WorkflowStep[]> {
  const data =
    await fetchApi<WorkflowStep[]>(
      `${API_BASE_URL}/api/workflows/${encodeURIComponent(
        templateId
      )}/steps`
    );

  return data ?? [];
}


// =====================================================
// WORKFLOW LAINNYA
// Sama seperti kode lama:
// tidak mensyaratkan is_active = true
// =====================================================

export async function getWorkflowLainnya():
  Promise<WorkflowTemplate | null> {
  return fetchApi<WorkflowTemplate>(
    `${API_BASE_URL}/api/workflows/lainnya/template`
  );
}


// =====================================================
// WORKFLOW BERDASARKAN NAMA
// =====================================================

export async function getWorkflowByName(
  name: string
): Promise<WorkflowTemplate | null> {
  return fetchApi<WorkflowTemplate>(
    `${API_BASE_URL}/api/workflows/by-name?name=${encodeURIComponent(
      name
    )}`
  );
}