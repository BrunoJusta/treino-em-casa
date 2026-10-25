-- Elíptica: material novo do ginásio de casa, com os exercícios em src/data/exercises.json.
insert into public.equipment (id, name, category, icon, details, location, status, max_load_kg, notes)
values ('eliptica', 'Elíptica', 'cardio', 'elliptical', 'Cardio sem impacto, com pegas móveis para trabalhar também os braços.', 'Lá em baixo', 'ok', null, '')
on conflict (id) do nothing;
