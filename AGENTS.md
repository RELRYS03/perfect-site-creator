<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use the root StudioProvider for in-session model configuration and projects so navigation preserves edits; durable saving is explicit JSON download/import, not browser storage.
- Keep browser 3D rendering in the lazy ModelScene behind ClientOnly, using Three.js for geometry and STL/GLB exports; hosted runtime cannot execute the uploaded Windows/Blender subprocess scripts.
- Define visual roles in src/styles.css and use shared Button controls to maintain the editor's semantic design system.
- Keep Organizador 3D geometry in pure TS (src/lib/organizer) with tests; it is independent from the medal buildModel so the medal editor stays untouched.
- Define STL upload validation in the shared uploadLimits module so the displayed limit and the file-size check stay consistent.
