package br.com.novexa.erp.service;
import br.com.novexa.erp.dto.ConfiguracaoRecebimentosDTO;
import br.com.novexa.erp.repository.EmpresaRepository;
import br.com.novexa.erp.security.UsuarioAutenticado;
import br.com.novexa.erp.entity.PerfilUsuario;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
@Service
public class ConfiguracaoRecebimentosService {
    private final EmpresaRepository empresas;
    private final jakarta.persistence.EntityManager em;
    public ConfiguracaoRecebimentosService(EmpresaRepository empresas, jakarta.persistence.EntityManager em) { this.empresas=empresas; this.em=em; }
    @Transactional(readOnly=true)
    public ConfiguracaoRecebimentosDTO consultar(Long empresaId) {
        return ConfiguracaoRecebimentosDTO.de(empresas.findById(empresaId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Empresa não encontrada.")));
    }
    @Transactional
    public ConfiguracaoRecebimentosDTO alterar(ConfiguracaoRecebimentosDTO pedido, UsuarioAutenticado usuario) {
        if (usuario.perfil()!=PerfilUsuario.ADMIN && usuario.perfil()!=PerfilUsuario.GERENTE)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Somente administradores e gestores podem configurar recebimentos.");
        var empresa=empresas.politicaParaAlterar(usuario.empresaId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Empresa não encontrada."));
        em.refresh(empresa);
        empresa.configurarRecebimentos(pedido.modo(),pedido.conferencia()==null?empresa.getModoConferenciaFechamento():pedido.conferencia(),
                pedido.exigirValoresInformadosNoFechamento()==null?empresa.isExigirValoresInformadosNoFechamento():pedido.exigirValoresInformadosNoFechamento());
        empresas.saveAndFlush(empresa);
        return ConfiguracaoRecebimentosDTO.de(empresa);
    }
}
