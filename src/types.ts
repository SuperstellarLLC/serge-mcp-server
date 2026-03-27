export interface ActionEvent {
  index: number;
  timestamp: string;
  action: 'navigate' | 'click' | 'type' | 'scroll' | 'read_page' | 'screenshot';
  params: Record<string, any>;
  result: {
    success: boolean;
    duration_ms: number;
    error?: string;
    element_found?: boolean;
    element_tag?: string;
    element_aria_label?: string;
    triggered_navigation?: boolean;
    url_after?: string;
  };
  screenshot_path?: string;
  page_url: string;
  page_title: string;
}

export interface NetworkEvent {
  timestamp: string;
  method: string;
  url: string;
  status: number;
  response_time_ms: number;
  content_type: string;
  size_bytes: number;
}

export interface Session {
  session_id: string;
  domain: string;
  task: string;
  started_at: string;
  ended_at?: string;
  outcome?: 'success' | 'failure' | 'partial';
  notes?: string;
  total_steps: number;
  total_duration_ms: number;
  actions: ActionEvent[];
  network: NetworkEvent[];
}

export interface SessionState {
  session: Session;
  current_step: number;
  session_dir: string;
  screenshots_dir: string;
  start_time: number;
}
