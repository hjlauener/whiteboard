/**
 * Templates of the board ("Vorlagen"), sorted by topic: the single list of
 * topics and template ids. The board builds each template from commands
 * (src/templates/catalog.ts); the build writes js/dist/templates.json, from
 * which the plugin configuration (ilUdwTemplates) lists them, so that single
 * templates can be switched off in the Administration. All are on by default.
 *
 * Names and texts: language files, keys tplcat_<topic>, tpl_<id>,
 * tpl_<id>_info and tplt_<id>_<text> (contents of the template).
 */
export const TEMPLATE_TOPICS: ReadonlyArray<{ id: string; templates: readonly string[] }> = [
  {
    id: "didactics",
    templates: [
      "lesson_plan",
      "syllabus",
      "study_board",
      "reflection",
      "objectives",
      "concept_map",
      "english_tenses",
      "clothes",
      "warm_up",
      "family_tree",
      "book_outline",
      "icebreaker",
      "onboarding",
    ],
  },
  { id: "brainstorming", templates: ["brainstorming", "reverse_brainstorming", "clustering"] },
  { id: "org", templates: ["org_chart"] },
  { id: "diagrams", templates: ["flowchart", "swot", "decision_matrix", "timeline", "wireframe", "moodboard"] },
  { id: "mapping", templates: ["mind_map", "customer_journey", "user_story_map", "roadmap", "business_model_canvas", "diagram_mapping"] },
  { id: "workshops", templates: ["retrospective", "agenda"] },
  { id: "worktools", templates: ["eisenhower", "impact_effort", "moscow", "smart", "todo", "week_planner", "pomodoro", "kanban"] },
];
