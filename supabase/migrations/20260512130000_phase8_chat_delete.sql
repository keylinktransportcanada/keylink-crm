-- Phase 8 follow-up: let chat members delete a thread.
--
-- A 1:1 DM has two equal parties, so either of them should be able to
-- close the conversation entirely. For group threads (v2), the creator
-- already has stricter ownership semantics — for now we lean permissive
-- and let any member delete; this matches Slack/Teams "Leave + remove"
-- behaviour. The FK cascades on chat_thread_members, chat_messages, and
-- documents.chat_message_id take care of the children.

drop policy if exists "chat_threads: member delete" on public.chat_threads;

create policy "chat_threads: member delete"
  on public.chat_threads for delete
  using (public.is_chat_thread_member(id));
