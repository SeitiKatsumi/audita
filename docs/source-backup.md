# Codigo-fonte e backup da Audita

O aplicativo esta no repositorio privado https://github.com/SeitiKatsumi/audita. O site usa repositorio separado; guardar os dois. O codigo identifica o funcionamento e as versoes. O banco, chaves e arquivos dos atendimentos ficam em armazenamento privado separado; o repositorio tambem contem um kit juridico restrito em private-documents, que foi excluido do ZIP de codigo desta entrega.

Para guardar uma copia: abrir o repositorio autorizado no GitHub, escolher a branch main e Code → Download ZIP. O ZIP do GitHub pode incluir o kit restrito; nao compartilhar essa copia fora dos destinatarios autorizados. Guardar a data e o commit junto ao ZIP, em pasta privada da Audita, com uma segunda copia em local distinto. Quem nao tem acesso deve solicitar convite ao responsavel pelo repositorio, sem compartilhar senha.

O arquivo ZIP desta entrega contem somente arquivos versionados da aplicacao, da revisao indicada no nome. Configuracao privada, documentos, banco, capturas e arquivos temporarios ficaram fora. Para restaurar o sistema completo tambem sao necessarios os backups privados do PostgreSQL, volumes de documentos/PDFs e configuracao do CapRover, mantidos separadamente e com acesso restrito.

Publicacao no GitHub e execucao em producao sao passos diferentes: conferir o commit em /api/health e o registro de deploy em docs/STATUS.md. Uma copia do codigo nao comprova o registro do software ou da marca. O momento, autoria, documentos e procedimento de registro devem ser definidos com Seiti e o responsavel juridico.
