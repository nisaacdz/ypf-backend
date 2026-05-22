# Workspace Notes API Plan

## Purpose

Committee workspaces need lightweight notes on operational records without moving users out of their workspace. The first consumer is the Programs & Records workspace for program and event notes.

## Proposed Endpoints

- `GET /api/v1/workspace-notes?committeeId=&entityType=&entityId=`
- `POST /api/v1/workspace-notes`

## Note Shape

```ts
type WorkspaceNote = {
  id: string
  committeeId: string
  entityType: "program" | "event"
  entityId: string
  body: string
  authorId: string
  createdAt: string
}
```

## Access Rules

- Committee chairs and committee members can create and view notes for their own committee workspace.
- Super admins and regular admins can create and view notes for any committee workspace.
- Only the note author, super admins, and regular admins can delete notes.
- Core entity permissions remain separate: notes do not grant permission to create, edit, archive, or delete programs/events.

## First Integration Target

Programs & Records:

- `entityType: "program"` for program detail drawer notes.
- `entityType: "event"` for event detail drawer notes.
