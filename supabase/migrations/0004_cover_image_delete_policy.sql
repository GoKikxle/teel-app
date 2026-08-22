-- The cover-images Storage policies in 0001_init.sql were written as a
-- commented-out "run this yourself after creating the bucket" block, and
-- write/public-read clearly got set up at some point (uploads and public
-- reads both work in production) — but the owner-delete policy did not.
-- Confirmed directly: deleteGathering() calls supabase.storage.remove() on
-- the organizer's own cover image, and Storage returns a 403 AccessDenied
-- (verified against production), which deleteCoverImage() logs but swallows
-- as non-fatal — so the gathering row deletes cleanly while its cover photo
-- silently stays behind in the bucket forever. Every gathering deleted since
-- launch has likely leaked its cover image this way.
--
-- Same ownership pattern as the write policy that's already working
-- (folder-scoped to the uploader's own auth.uid()).
create policy "cover_images_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'cover-images' and (storage.foldername(name))[1] = auth.uid()::text);
