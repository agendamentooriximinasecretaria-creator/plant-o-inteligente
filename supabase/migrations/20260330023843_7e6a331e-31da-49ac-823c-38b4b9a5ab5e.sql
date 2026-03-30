-- Fix security definer view issue - recreate as security invoker
ALTER VIEW public.professionals_safe SET (security_invoker = on);