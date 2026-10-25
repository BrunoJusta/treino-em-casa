-- Bola de Pilates: material novo do ginásio de casa, com os exercícios em src/data/exercises.json.
insert into public.equipment (id, name, category, icon, details, location, status, max_load_kg, notes)
values ('bola-pilates', 'Bola de Pilates', 'accessory', 'ball', 'Bola grande de ginástica, para core, equilíbrio e alongamentos.', 'Lá em baixo', 'ok', null, 'Enche-a até ficares sentado com as coxas paralelas ao chão.')
on conflict (id) do nothing;
