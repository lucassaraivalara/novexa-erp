package br.com.novexa.erp.util;

import br.com.novexa.erp.exception.EmpresaInvalidaException;
import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.util.Base64;

public final class LogomarcaUtils {
    private LogomarcaUtils() { }

    public static String validar(String imagem) {
        if (imagem == null || imagem.isBlank()) return null;
        try {
            if (imagem.length() > 1400000 || !imagem.matches("^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$")) throw new IllegalArgumentException();
            byte[] bytes = Base64.getDecoder().decode(imagem.substring(imagem.indexOf(',') + 1));
            if (bytes.length > 1048576) throw new IllegalArgumentException();
            try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var leitores = ImageIO.getImageReaders(stream);
                if (!leitores.hasNext()) throw new IllegalArgumentException();
                var leitor = leitores.next();
                try {
                    leitor.setInput(stream);
                    String formato = leitor.getFormatName().toLowerCase();
                    if (!(formato.equals("png") || formato.equals("jpeg")) || !imagem.startsWith("data:image/" + formato + ";")
                            || leitor.getWidth(0) > 2048 || leitor.getHeight(0) > 2048) throw new IllegalArgumentException();
                    leitor.read(0); // Rejeita arquivos truncados, além de validar o cabeçalho.
                } finally { leitor.dispose(); }
            }
            return imagem;
        } catch (Exception e) {
            throw new EmpresaInvalidaException("Use uma imagem PNG ou JPEG válida, até 1 MB e 2048 × 2048 pixels.");
        }
    }
}
