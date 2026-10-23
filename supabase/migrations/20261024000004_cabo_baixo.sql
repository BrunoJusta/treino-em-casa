-- O cabo de baixo da multiestação está avariado: os exercícios que o usavam saíram da app.
-- Para quem já correu o seed antes desta mudança.
update public.equipment
set details = 'Puxada, butterfly, pullover, cabo de cima (tríceps, abdominal e remada), extensão de pernas, flexão de pernas em pé, adutor e banco abdominal.',
    notes = 'O cabo de baixo está avariado.'
where id = 'multiestacao';
