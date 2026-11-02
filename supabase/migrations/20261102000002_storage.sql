-- Private product image bucket. Object paths are "<business_id>/<product_id>/<file>".
-- Members of a business can read its images (via signed URLs); only its admins can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy product_images_read on storage.objects for select to authenticated
  using (bucket_id = 'product-images'
         and public.is_member_of(public.try_uuid((storage.foldername(name))[1])));

create policy product_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images'
              and public.is_admin_of(public.try_uuid((storage.foldername(name))[1])));

create policy product_images_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images'
         and public.is_admin_of(public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'product-images'
              and public.is_admin_of(public.try_uuid((storage.foldername(name))[1])));

create policy product_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images'
         and public.is_admin_of(public.try_uuid((storage.foldername(name))[1])));
