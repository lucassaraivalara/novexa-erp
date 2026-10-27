package br.com.novexa.erp.storage;
import org.junit.jupiter.api.Test;
import org.springframework.http.*;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.hamcrest.Matchers.matchesPattern;
class SupabaseCacheControlTest {
 @Test void cacheEUrlDistintaSemDependerDoUploadParalelo() {
  var storage=new SupabaseStorageService();
  ReflectionTestUtils.setField(storage,"supabaseUrl","https://storage.test");
  ReflectionTestUtils.setField(storage,"supabaseSecretKey","synthetic");
  ReflectionTestUtils.setField(storage,"supabaseBucket","produtos");
  var mock=MockRestServiceServer.createServer((RestTemplate)ReflectionTestUtils.getField(storage,"restTemplate"));
  for(int i=0;i<2;i++) mock.expect(requestTo(matchesPattern("https://storage\\.test/storage/v1/object/produtos/empresa-1/produto-1/[0-9a-f-]{36}\\.png")))
    .andExpect(header("Cache-Control","public, max-age=31536000, immutable"))
    .andRespond(withSuccess("{}",MediaType.APPLICATION_JSON));
  var file=new MockMultipartFile("arquivo","foto.png","image/png",new byte[]{1,2,3});
  var first=storage.salvarImagemProduto(1L,1L,file);var second=storage.salvarImagemProduto(1L,1L,file);
  assertThat(storage.obterUrlPublica(first)).isNotEqualTo(storage.obterUrlPublica(second));mock.verify();
 }
}