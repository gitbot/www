from fswrap import File
from hyde.plugin import CLTransformer
import subprocess


class DustPlugin(CLTransformer):

    @property
    def executable_name(self):
        return 'dustc'

    def begin_text_resource(self, resource, text):
        if not resource.meta.dust:
            return
        source = File.make_temp(text.strip())
        target = source
        dust = self.app

        args = [unicode(dust)]
        args.append("--name=" + resource.source_file.name_without_extension)
        args.append(unicode(source))
        args.append(unicode(target))
        try:
            self.call_app(args)
        except subprocess.CalledProcessError:
            raise self.template.exception_class(
                    "Cannot process %s. Error occurred when "
                    "processing [%s]" % (self.name, resource.source_file))
        return target.read_all()
